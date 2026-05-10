"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SeatBlockGrid from './SeatBlockGrid';
import { groupSeatsByRow, groupSeatsByFloor, groupSeatsByBlocks } from '../lib/seats';
import { STUDY_ROOM_SLOTS } from '../lib/slots';

const STATUS_COPY = {
  available: '예약 가능',
  reserved: '예약됨',
  mine: '내 예약',
  blocked: '신청불가',
  empty: '표지'
};

function formatTime(isoTime) {
  if (!isoTime) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoTime));
}

export default function SeatReservationApp() {
  const router = useRouter();
  const [memId, setMemId] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [stIdxFull, setStIdxFull] = useState(STUDY_ROOM_SLOTS[0].value);
  const [seatSearch, setSeatSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('1층');
  const [selectedSeatIdx, setSelectedSeatIdx] = useState(null);
  const [seats, setSeats] = useState([]);
  const [myReservation, setMyReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [selectedSeatDetail, setSelectedSeatDetail] = useState(null);

  const stats = useMemo(() => {
    const total = seats.length;
    const mine = seats.filter((seat) => seat.status === 'mine').length;
    const reserved = seats.filter((seat) => seat.status === 'reserved').length;
    const available = seats.filter((seat) => seat.status === 'available').length;

    return { total, mine, reserved, available };
  }, [seats]);

  const filteredSeats = useMemo(() => {
    if (!seatSearch.trim()) {
      return seats;
    }

    const query = seatSearch.trim();
    return seats.filter((seat) => String(seat.seatNo).includes(query) || String(seat.srt_num).includes(query));
  }, [seatSearch, seats]);

  const floorSeats = useMemo(() => groupSeatsByFloor(filteredSeats), [filteredSeats]);
  
  const groupedSeats = useMemo(() => {
    const selected = floorSeats[selectedFloor] || [];
    return groupSeatsByBlocks(selected);
  }, [floorSeats, selectedFloor]);

  async function loadSeats() {
    setLoading(true);

    try {
      const response = await fetch(`/api/seats?stIdxFull=${encodeURIComponent(stIdxFull)}`, { credentials: 'same-origin' });
      const data = await response.json();

      if (!response.ok || data.result !== 'success') {
        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        throw new Error(data.resMsg || data.hMsg || '좌석 정보를 가져오지 못했습니다.');
      }

      setSeats(data.seats || []);
      setMyReservation(data.myReservation || null);
      setMessage(data.hMsg || '좌석 현황을 불러왔습니다.');
      setMessageType('info');

      if (data.myReservation) {
        setSelectedSeatIdx(data.myReservation.seatIdx);
      }
    } catch (error) {
      setMessage(error.message || '좌석 정보를 가져오지 못했습니다.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
          const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
        const data = await response.json();

        if (!response.ok || data.result !== 'success') {
          router.replace('/login');
          return;
        }

        setIsAuthenticated(true);
        setMemId(data.session.memId || '');
        setIsMaster(data.isMaster || false);
        setDeviceRegistered(false);
        await loadSeats();
      } catch {
        router.replace('/login');
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stIdxFull]);

  async function handleReserve(seat) {
    setSubmitting(true);

    try {
      console.log('[Reserve] Attempting reservation for seat:', seat, 'stIdxFull:', stIdxFull);
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          seat: {
            clr_idx: seat.clr_idx,
            srt_idx: seat.srt_idx,
            stIdxFull
          },
          stIdxFull,
        })
      });

      const data = await response.json();
      console.log('[Reserve] Response:', { status: response.status, ok: response.ok, data });

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || data.hMsg || data.retMsg || '예약 중 오류가 발생했습니다.');
      }

      setMessage(`${seat.seatNo}번 좌석 예약이 완료되었습니다.`);
      setMessageType('success');
      setSelectedSeatIdx(seat.srt_idx);
      await loadSeats();
    } catch (error) {
      setMessage(error.message || '예약 중 오류가 발생했습니다.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(seat) {
    // Master는 모든 예약된 좌석 취소 가능, 일반 사용자는 자신의 좌석만 취소 가능
    if (!isMaster && seat.status !== 'mine') {
      setMessage('자신의 예약만 취소할 수 있습니다.');
      setMessageType('error');
      return;
    }

    setSubmitting(true);

    try {
      console.log('[Cancel] Seat data:', {
        seatNo: seat.seatNo,
        sre_idx: seat.sre_idx,
        srt_idx: seat.srt_idx,
        status: seat.status,
        fullSeat: seat,
        isMaster
      });

      if (!seat.sre_idx) {
        throw new Error('예약 정보(sre_idx)가 없습니다. 새로고침 후 다시 시도해주세요.');
      }

      const payload = {
        seat: {
          sre_idx: seat.sre_idx,
          stIdxFull
        }
      };

      console.log('[Cancel] Request payload:', payload);

      const response = await fetch('/api/reservations', {
        method: 'DELETE', 
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      console.log('[Cancel] Response:', {
        status: response.status,
        ok: response.ok,
        data
      });

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || data.hMsg || data.retMsg || `취소 실패 (${response.status}): ${JSON.stringify(data)}`);
      }

      setMessage(`${seat.seatNo}번 좌석 예약을 취소했습니다.`);
      setMessageType('success');
      setSelectedSeatIdx(null);
      await loadSeats();
    } catch (error) {
      console.error('[Cancel] Error:', error);
      setMessage(error.message || '취소 중 오류가 발생했습니다.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSeatRightClick(seat, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isMaster) {
      return;
    }

    if (seat.status !== 'reserved' && seat.status !== 'mine') {
      return;
    }

    setSelectedSeatDetail(seat);
  }

  function applyProfile() {
    loadSeats();
    setMessage('좌석 정보를 다시 불러왔습니다.');
    setMessageType('info');
  }

  async function handleDeviceRegister() {
    if (!isAuthenticated) {
      setMessage('로그인 후 기기를 등록할 수 있습니다.');
      setMessageType('error');
      return;
    }

    const response = await fetch('/api/member/update-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({})
    });
    const data = await response.json();

    if (!response.ok || data.result !== 'success') {
      setMessage(data.resMsg || '기기 등록에 실패했습니다.');
      setMessageType('error');
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('fastintra_device_registered', '1');
    }

    setDeviceRegistered(true);
    setMessage('기기등록 완료 하였습니다.');
    setMessageType('success');
  }

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('_loggedOut', '1');
      }
      router.replace('/login');
    });
  }

  const selectedSeat = seats.find((seat) => seat.srt_idx === selectedSeatIdx) || myReservation || null;

  return (
    <main className={`page-shell${isMaster ? ' master-window' : ''}`}>
      <section className="hero">
        <div className="eyebrow">Library Seat Reservation</div>
        <h1>New FASTINTRA</h1>
        <p>
          도서관 예약의 자유를 위한 새로운 FASTINTRA by POWERPROGRAMMER
        </p>

        <div className="hero-metrics">
          <div className="metric">
            <span>전체 좌석</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="metric">
            <span>예약 가능</span>
            <strong>{stats.available}</strong>
          </div>
          <div className="metric">
            <span>예약 중</span>
            <strong>{stats.reserved}</strong>
          </div>
          <div className="metric">
            <span>내 예약</span>
            <strong>{stats.mine}</strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel side-panel">
          <div>
            <h2 className="section-title">이용자 정보</h2>
            <div className="toast" style={{ marginTop: 12 }}>
              {isAuthenticated ? `로그인됨: ${memId || '알 수 없음'}` : '로그인이 필요합니다.'}
            </div>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip">
                <span className="chip-dot" style={{ background: '#15803d' }} /> 세션 연결됨
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="button button-primary" onClick={applyProfile} disabled={submitting}>
                새로고침
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="button button-muted" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </div>

          <div className="search-row">
            <h2 className="section-title">타임 선택</h2>
            <div className="slot-list">
              {STUDY_ROOM_SLOTS.map((slot) => (
                <label key={slot.value} className={`slot-item ${stIdxFull === slot.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="stIdxFull"
                    value={slot.value}
                    checked={stIdxFull === slot.value}
                    onChange={(event) => setStIdxFull(event.target.value)}
                  />
                  <span>\n                    <strong>{slot.label}</strong>\n                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="search-row">
            <h2 className="section-title">구역 선택</h2>
            <div className="floor-tabs">
              {['1층', '2층', '토의실A', '토의실B'].map((floor) => (
                <button
                  key={floor}
                  type="button"
                  className={`floor-tab ${selectedFloor === floor ? 'active' : ''}`}
                  onClick={() => setSelectedFloor(floor)}
                >
                  {floor}
                  <small>({(floorSeats[floor] || []).length})</small>
                </button>
              ))}
            </div>
          </div>

          <div className="search-row">
            <h2 className="section-title">좌석 검색</h2>
            <div className="inline-actions">
              <input
                value={seatSearch}
                onChange={(event) => setSeatSearch(event.target.value)}
                placeholder="2-81, 2-85,.. 검색"
              />
              <button type="button" className="button button-muted" onClick={() => setSeatSearch('')}>
                초기화
              </button>
            </div>
          </div>

          <div className="summary-card">
            <small>현재 선택 / 내 예약</small>
            <strong>{selectedSeat ? selectedSeat.seatNo : '-'}</strong>
            <div className="summary-row">
              <span>상태</span>
              <span>{selectedSeat ? STATUS_COPY[selectedSeat.status] || '확인 필요' : '선택 없음'}</span>
            </div>
            <div className="summary-row">
              <span>좌석 번호</span>
              <span>{selectedSeat ? `${selectedSeat.srt_num}` : '-'}</span>
            </div>
            <div className="summary-row">
              <span>예약 시간</span>
              <span>{myReservation ? formatTime(myReservation.createdAt) : '-'}</span>
            </div>
          </div>

          <div className="chip-row">
            <span className="chip"><span className="chip-dot" style={{ background: '#15803d' }} /> 예약 가능</span>
            <span className="chip"><span className="chip-dot" style={{ background: '#d97706' }} /> 예약됨</span>
            <span className="chip"><span className="chip-dot" style={{ background: '#2563eb' }} /> 내 예약</span>
          </div>

          <div className="status-box">
            <h3>기기 등록</h3>
            <p style={{ marginBottom: 12 }}>
              도서관 신청은 마지막으로 등록한 기기 한 곳에서만 가능하도록 동작합니다.
            </p>
            <button type="button" className="button button-primary" onClick={handleDeviceRegister}>
              {deviceRegistered ? '기기 재등록' : '기기 등록'}
            </button>
          </div>

          <div className="status-box">
            <h3>상태 메시지</h3>
            <p className={messageType === 'error' ? 'toast error' : 'toast'}>{message || '좌석을 선택하거나 검색해 보세요.'}</p>
          </div>

          <div className="status-box">
            <h3>예약 규칙</h3>
            <p>
              시간 제약 없고 마음대로 신청하셈 자유의 인트라넷 FASTINTRA
            </p>
          </div>
        </aside>

        <section className="panel map-panel">
          <div className="map-header">
            <div>
              <h2>도서관 좌석 배치</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                선택한 타임({STUDY_ROOM_SLOTS.find((slot) => slot.value === stIdxFull)?.label})에 따라 좌석 상태가 분리됩니다.
              </p>
            </div>
            <div className="legend">
              <div className="legend-item"><span className="legend-swatch" style={{ background: '#e7f8ee' }} /> 예약 가능</div>
              <div className="legend-item"><span className="legend-swatch" style={{ background: '#fde68a' }} /> 예약됨</div>
              <div className="legend-item"><span className="legend-swatch" style={{ background: '#bfdbfe' }} /> 내 예약</div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">좌석 데이터를 불러오는 중입니다...</div>
          ) : (
            <SeatBlockGrid
              blocks={groupedSeats}
              onSeatSelect={handleReserve}
              onCancelSeat={handleCancel}
              onSeatRightClick={handleSeatRightClick}
              selectedSeatIdx={selectedSeatIdx}
              isMaster={isMaster}
            />
          )}
        </section>
      </section>

      {/* Seat Detail Modal (Master Only) */}
      {selectedSeatDetail && isMaster && (
        <div className="seat-detail-modal" onClick={() => setSelectedSeatDetail(null)}>
          <div className="seat-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="seat-detail-header">
              <h3>{selectedSeatDetail.seatNo}번 좌석 정보</h3>
              <button
                className="close-button"
                onClick={() => setSelectedSeatDetail(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="seat-detail-body">
              <div className="detail-item">
                <strong>좌석 번호</strong>
                <span>{selectedSeatDetail.seatNo}</span>
              </div>
              <div className="detail-item">
                <strong>예약자</strong>
                <span>{selectedSeatDetail.requesterName || '-'}</span>
              </div>
              <div className="detail-item">
                <strong>상태</strong>
                <span>{STATUS_COPY[selectedSeatDetail.status] || selectedSeatDetail.status}</span>
              </div>
              {selectedSeatDetail.status === 'mine' && (
                <button
                  className="button button-primary"
                  onClick={() => {
                    handleCancel(selectedSeatDetail);
                    setSelectedSeatDetail(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  예약 취소
                </button>
              )}
              {selectedSeatDetail.status === 'reserved' && isMaster && (
                <button
                  className="button button-danger"
                  onClick={() => {
                    handleCancel(selectedSeatDetail);
                    setSelectedSeatDetail(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  예약 강제 취소 (Master)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }} className="toast">
        API: <strong>/api/seats</strong> 조회, <strong>/api/reservations</strong> 예약/취소
      </div>
    </main>
  );
}