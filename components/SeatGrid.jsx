"use client";

export default function SeatGrid({ groupedSeats, onSeatSelect, onCancelSeat, selectedSeatIdx }) {
  if (!groupedSeats.length) {
    return (
      <div className="empty-state">
        <strong>좌석을 불러올 수 없습니다.</strong>
        <p>조금 뒤 다시 시도해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="seat-grid" role="grid" aria-label="도서관 좌석 배치">
      {groupedSeats.map((row) => (
        <div className="seat-row" key={row.row} role="row">
          <div className="row-label">{row.row}F</div>
          {row.seats.map((seat) => {
            const isAvailable = seat.status === 'available';
            const isMine = seat.status === 'mine';
            const isReserved = seat.status === 'reserved';
            const isSelected = selectedSeatIdx === seat.srt_idx;

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
                <div>
                  <div className="seat-number">{seat.seatNo}</div>
                  <div className="seat-meta">
                    {seat.status === 'available' && '예약 가능'}
                    {seat.status === 'reserved' && '예약 중'}
                    {seat.status === 'mine' && '내 좌석'}
                  </div>
                  {isMine ? (
                    <button
                      type="button"
                      className="seat-action"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onCancelSeat(seat);
                      }}
                    >
                      취소
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}