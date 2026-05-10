"use client";

export default function SeatBlockGrid({ blocks, onSeatSelect, onCancelSeat, onSeatRightClick, selectedSeatIdx, isMaster = false }) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="empty-state">
        <strong>좌석을 불러올 수 없습니다.</strong>
        <p>조금 뒤 다시 시도해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="seat-block-grid" role="region" aria-label="도서관 좌석 배치도">
      {blocks.map((block, blockIdx) => {
        const { xs, ys, data } = block.grid;
        
        return (
          <div key={blockIdx} className="seat-block">
            <div
              className="block-content"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${xs.length}, 1fr)`,
                gap: '4px',
                padding: '8px'
              }}
            >
              {ys.flatMap((y) =>
                xs.map((x) => {
                  const seat = data.get(`${x},${y}`);
                  if (!seat) {
                    return (
                      <div key={`${x}-${y}-empty`} className="seat-empty-slot" />
                    );
                  }

                  const isAvailable = seat.status === 'available';
                  const isMine = seat.status === 'mine';
                  const isReserved = seat.status === 'reserved';
                  const isSelected = selectedSeatIdx === seat.srt_idx;
                  const canShowCancelButton = isMine || (isMaster && (isReserved || isMine));

                  const seatClassName = [
                    'seat-cell',
                    isAvailable ? 'seat-available seat-clickable' : '',
                    isReserved ? 'seat-reserved' : '',
                    isMine ? 'seat-mine' : '',
                    !isAvailable && !isReserved && !isMine ? 'seat-empty' : '',
                    isSelected ? 'seat-focus' : ''
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={seat.srt_idx}
                      className={seatClassName}
                      role={isAvailable ? 'button' : 'gridcell'}
                      tabIndex={isAvailable ? 0 : -1}
                      onClick={() => {
                        if (isAvailable) {
                          onSeatSelect(seat);
                        }
                      }}
                      onContextMenu={(event) => {
                        if (onSeatRightClick) {
                          onSeatRightClick(seat, event);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!isAvailable) {
                          return;
                        }

                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSeatSelect(seat);
                        }
                      }}
                      aria-label={`${seat.seatNo}번 좌석 ${seat.status === 'available' ? '예약 가능' : seat.status === 'mine' ? '내 예약' : '예약됨'}`}
                    >
                      <div className="seat-content">
                        <div className="seat-number">{seat.seatNo}</div>
                        {isReserved && seat.requesterName ? (
                          <div className="seat-requester">{seat.requesterName}</div>
                        ) : null}
                        {canShowCancelButton ? (
                          <button
                            type="button"
                            className="seat-action-small"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onCancelSeat(seat);
                            }}
                            title={isMaster && isReserved ? "예약 취소 (Master)" : "예약 취소"}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
