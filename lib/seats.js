const SEAT_COUNT = 220;
const START_SEAT_NO = 100;
const START_SRT_IDX = 4341;
const START_SRT_NUM = 141;
const START_ROW = 11;
const SEATS_PER_ROW = 10;
const SRT_NUM_ROW_GAP = 14;

function padSeatNo(seatNo) {
  return String(seatNo);
}

export function buildSeatCatalog() {
  return Array.from({ length: SEAT_COUNT }, (_, index) => {
    const displayNo = START_SEAT_NO + index;
    const rowOffset = Math.floor(index / SEATS_PER_ROW);
    const colOffset = (index % SEATS_PER_ROW) + 1;
    const rowNumber = START_ROW + rowOffset;
    const actualSeatNumber = START_SRT_NUM + rowOffset * SRT_NUM_ROW_GAP + (colOffset - 1);

    return {
      seatNo: displayNo,
      srt_idx: START_SRT_IDX + index,
      c_place_cd: '8001',
      c_place_cd_name: '도서관',
      srt_num: actualSeatNumber,
      srt_x: colOffset,
      srt_y: rowNumber,
      srt_cont: padSeatNo(displayNo),
      srt_type: '1',
      srt_use_yn: 'Y',
      holidayYn: 'N'
    };
  });
}

export function groupSeatsByFloor(seats) {
  if (!seats || seats.length === 0) {
    return {
      '2층': [],
      '1층': [],
      '토의실A': [],
      '토의실B': [],
      '기타': []
    };
  }

  const floors = {
    '1층': [],
    '2층': [],
    '토의실A': [],
    '토의실B': [],
    '기타': []
  };

  seats.forEach((seat) => {
    const cont = String(seat.srt_cont || seat.seatNo || '').trim();
    
    if (cont.startsWith('1-') || cont === '1F입구') {
      floors['1층'].push(seat);
    } else if (cont.startsWith('2-') || cont === '2F입구') {
      floors['2층'].push(seat);
    } else if (cont.startsWith('3-')) {
      floors['토의실A'].push(seat);
    } else if (cont.startsWith('4-')) {
      floors['토의실B'].push(seat);
    } else {
      floors['기타'].push(seat);
    }
  });

  // Sort each floor by coordinates then by label
  Object.keys(floors).forEach((floor) => {
    floors[floor] = floors[floor].sort((a, b) => {
      const yDiff = b.srt_y - a.srt_y; // Higher y first
      if (yDiff !== 0) return yDiff;
      return b.srt_x - a.srt_x; // Higher x first
    });
  });

  return floors;
}

export function groupSeatsByBlocks(seats) {
  if (!seats || seats.length === 0) {
    return [];
  }

  const sorted = [...seats].sort((a, b) => {
    // Sort by Y descending, then X ascending for left-to-right reading
    const yDiff = b.srt_y - a.srt_y;
    return yDiff !== 0 ? yDiff : a.srt_x - b.srt_x;
  });

  // Group by Y coordinate with gap detection
  const yGroups = new Map();
  let prevY = null;
  const yGapThreshold = 3;

  sorted.forEach((seat) => {
    const y = seat.srt_y;
    
    // Detect gap in Y coordinates
    if (prevY !== null && y - prevY > yGapThreshold) {
      prevY = y; // New section
    } else if (prevY === null) {
      prevY = y;
    }

    if (!yGroups.has(prevY)) {
      yGroups.set(prevY, []);
    }
    yGroups.get(prevY).push(seat);
  });

  // Convert Y groups to block rows
  const blocks = [];
  for (const yGroup of yGroups.values()) {
    // Group by X coordinate within each Y group
    const xGroups = new Map();
    
    yGroup.forEach((seat) => {
      const x = seat.srt_x;
      if (!xGroups.has(x)) {
        xGroups.set(x, []);
      }
      xGroups.get(x).push(seat);
    });

    // Create sub-blocks from X groups
    const xValues = Array.from(xGroups.keys()).sort((a, b) => a - b);
    const xBlocks = [];
    let currentXBlock = [xValues[0]];

    for (let i = 1; i < xValues.length; i++) {
      if (xValues[i] - xValues[i - 1] <= 1) {
        currentXBlock.push(xValues[i]);
      } else {
        xBlocks.push(currentXBlock);
        currentXBlock = [xValues[i]];
      }
    }
    xBlocks.push(currentXBlock);

    // Create blocks from X block groups
    xBlocks.forEach((xBlock) => {
      const blockSeats = yGroup.filter((s) => xBlock.includes(s.srt_x));
      if (blockSeats.length > 0) {
        const minY = Math.min(...blockSeats.map((s) => s.srt_y));
        const maxY = Math.max(...blockSeats.map((s) => s.srt_y));
        const minX = Math.min(...blockSeats.map((s) => s.srt_x));
        const maxX = Math.max(...blockSeats.map((s) => s.srt_x));

        // Arrange seats in a 2D grid
        const grid = new Map();
        blockSeats.forEach((seat) => {
          const key = `${seat.srt_x},${seat.srt_y}`;
          grid.set(key, seat);
        });

        blocks.push({
          bounds: { minX, maxX, minY, maxY },
          seats: blockSeats,
          grid: {
            xs: Array.from(new Set(blockSeats.map((s) => s.srt_x))).sort((a, b) => a - b),
            ys: Array.from(new Set(blockSeats.map((s) => s.srt_y))).sort((a, b) => b - a),
            data: grid
          }
        });
      }
    });
  }

  return blocks;
}

export function groupSeatsByRow(seats) {
  if (!seats || seats.length === 0) {
    return [];
  }

  const rows = new Map();

  seats.forEach((seat) => {
    const row = seat.srt_y;
    if (!rows.has(row)) {
      rows.set(row, []);
    }
    rows.get(row).push(seat);
  });

  return Array.from(rows.entries())
    .sort(([rowA], [rowB]) => rowA - rowB)
    .map(([row, rowSeats]) => ({
      row,
      seats: rowSeats.slice().sort((left, right) => left.srt_x - right.srt_x)
    }));
}

export function findSeatByIdx(seatIdx) {
  return buildSeatCatalog().find((seat) => seat.srt_idx === seatIdx) || null;
}