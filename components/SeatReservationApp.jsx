"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SeatBlockGrid from './SeatBlockGrid';
import { readJsonResponse } from '../lib/api-client';
import { groupSeatsByRow, groupSeatsByFloor, groupSeatsByBlocks } from '../lib/seats';
import { getDefaultStudyRoomSlot, getStudyRoomSlots } from '../lib/slots';

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

function formatDetailValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function SeatDetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <strong>{label}</strong>
      <span>{formatDetailValue(value)}</span>
    </div>
  );
}

export default function SeatReservationApp() {
  const router = useRouter();
  const autoReserveTimerRef = useRef(null);
  const studyRoomSlots = useMemo(() => getStudyRoomSlots(), []);
  const [activeService, setActiveService] = useState('library');
  const [memId, setMemId] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [stIdxFull, setStIdxFull] = useState(() => getDefaultStudyRoomSlot());
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
  const [autoReserveSeatNo, setAutoReserveSeatNo] = useState('');
  const [autoReserveAt, setAutoReserveAt] = useState('');
  const [autoReserveStatus, setAutoReserveStatus] = useState('');
  const [classroomBuildings, setClassroomBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [classroomRooms, setClassroomRooms] = useState([]);
  const [classroomSearch, setClassroomSearch] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [classroomInfo, setClassroomInfo] = useState(null);
  const [classroomRequest, setClassroomRequest] = useState(null);
  const [classroomLoading, setClassroomLoading] = useState(false);

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

  const filteredClassroomRooms = useMemo(() => {
    const query = classroomSearch.trim().toLowerCase();
    if (!query) return classroomRooms;

    return classroomRooms.filter((room) => {
      const haystack = [
        room.roomName,
        room.roomCode,
        room.buildingName,
        room.stName,
        room.approvalName,
        room.teacherApprovalName
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [classroomRooms, classroomSearch]);

  const selectedSlotLabel = studyRoomSlots.find((slot) => slot.value === stIdxFull)?.label || stIdxFull;

  async function loadSeats() {
    setLoading(true);

    try {
      const response = await fetch(`/api/seats?stIdxFull=${encodeURIComponent(stIdxFull)}`, { credentials: 'same-origin' });
      const data = await readJsonResponse(response);

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

  async function loadClassroomBuildings() {
    setClassroomLoading(true);

    try {
      const response = await fetch(`/api/classrooms/buildings?stIdxFull=${encodeURIComponent(stIdxFull)}`, {
        credentials: 'same-origin'
      });
      const data = await readJsonResponse(response);

      if (!response.ok || data.result !== 'success') {
        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        throw new Error(data.resMsg || '교과교실 동 목록을 가져오지 못했습니다.');
      }

      const nextBuildings = data.buildings || [];
      setClassroomBuildings(nextBuildings);
      setSelectedBuilding((current) => {
        if (current && nextBuildings.some((building) => building.slgNum === current)) {
          return current;
        }

        return nextBuildings[0]?.slgNum || '';
      });
      setMessage('교과교실 동 목록을 불러왔습니다.');
      setMessageType('info');
    } catch (error) {
      setMessage(error.message || '교과교실 동 목록을 가져오지 못했습니다.');
      setMessageType('error');
    } finally {
      setClassroomLoading(false);
    }
  }

  async function loadClassroomRooms(slgNum = selectedBuilding) {
    if (!slgNum) {
      setClassroomRooms([]);
      setSelectedClassroom(null);
      setClassroomInfo(null);
      setClassroomRequest(null);
      return;
    }

    setClassroomLoading(true);

    try {
      const query = new URLSearchParams({ slgNum, stIdxFull }).toString();
      const response = await fetch(`/api/classrooms/rooms?${query}`, { credentials: 'same-origin' });
      const data = await readJsonResponse(response);

      if (!response.ok || data.result !== 'success') {
        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        throw new Error(data.resMsg || '교과교실 목록을 가져오지 못했습니다.');
      }

      setClassroomRooms(data.rooms || []);
      setSelectedClassroom(null);
      setClassroomInfo(null);
      setClassroomRequest(null);
      setMessage(data.rooms?.length ? '교과교실 목록을 불러왔습니다.' : '선택한 타임에 표시할 교과교실이 없습니다.');
      setMessageType(data.rooms?.length ? 'info' : 'error');
    } catch (error) {
      setMessage(error.message || '교과교실 목록을 가져오지 못했습니다.');
      setMessageType('error');
    } finally {
      setClassroomLoading(false);
    }
  }

  async function loadClassroomInfo(room) {
    if (!room?.crIdx) return;

    setSelectedClassroom(room);
    setClassroomInfo(null);
    setClassroomRequest(room.crtIdx ? { crt_idx: room.crtIdx, ...room.remote } : null);

    try {
      const response = await fetch(`/api/classrooms/info?crIdx=${encodeURIComponent(room.crIdx)}`, {
        credentials: 'same-origin'
      });
      const data = await readJsonResponse(response);

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || '교과교실 상세 정보를 가져오지 못했습니다.');
      }

      setClassroomInfo(data);
    } catch (error) {
      setMessage(error.message || '교과교실 상세 정보를 가져오지 못했습니다.');
      setMessageType('error');
    }
  }

  async function handleClassroomApply(room = selectedClassroom) {
    if (!room) {
      setMessage('신청할 교과교실을 선택해 주세요.');
      setMessageType('error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/classrooms/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          room: {
            slgNum: room.slgNum,
            crIdx: room.crIdx,
            stIdxFull,
            crtCont: ''
          }
        })
      });
      const data = await readJsonResponse(response);

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || data.hMsg || data.retMsg || '교과교실 신청 중 오류가 발생했습니다.');
      }

      const request = data.classRoomReqVo || data.item || null;
      const requestCrtIdx = Number(request?.crt_idx || request?.crtIdx || 0);
      if (requestCrtIdx) {
        setClassroomRequest(request);
        setSelectedClassroom({ ...room, crtIdx: requestCrtIdx });
      }

      setMessage(`${room.roomName || room.roomCode} 교과교실 신청이 완료되었습니다.`);
      setMessageType('success');
    } catch (error) {
      setMessage(error.message || '교과교실 신청 중 오류가 발생했습니다.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClassroomCancel(targetRequest = classroomRequest, targetRoom = selectedClassroom) {
    const crtIdx = Number(targetRequest?.crt_idx || targetRequest?.crtIdx || targetRoom?.crtIdx || 0);

    if (!crtIdx) {
      setMessage('취소할 교과교실 신청 정보(crt_idx)가 없습니다.');
      setMessageType('error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/classrooms/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ crtIdx })
      });
      const data = await readJsonResponse(response);

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || data.hMsg || data.retMsg || '교과교실 신청 취소 중 오류가 발생했습니다.');
      }

      setMessage('교과교실 신청을 취소했습니다.');
      setMessageType('success');
      setClassroomRequest(null);
      setSelectedClassroom((current) => (current ? { ...current, crtIdx: 0 } : current));
      if (selectedBuilding) {
        await loadClassroomRooms(selectedBuilding);
      }
    } catch (error) {
      setMessage(error.message || '교과교실 신청 취소 중 오류가 발생했습니다.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
          const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
        const data = await readJsonResponse(response);

        if (!response.ok || data.result !== 'success') {
          router.replace('/login');
          return;
        }

        setIsAuthenticated(true);
        setMemId(data.session.memId || '');
        setIsMaster(data.isMaster || false);
        setDeviceRegistered(false);
      } catch {
        router.replace('/login');
      }
    }

    bootstrap();
  }, []);

  useEffect(() => () => {
    if (autoReserveTimerRef.current) {
      clearTimeout(autoReserveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeService === 'library') {
      loadSeats();
      return;
    }

    loadClassroomBuildings();
    if (selectedBuilding) {
      loadClassroomRooms(selectedBuilding);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeService, isAuthenticated, stIdxFull]);

  useEffect(() => {
    if (!isAuthenticated || activeService !== 'classroom') return;
    loadClassroomRooms(selectedBuilding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding]);

  async function reserveSeatForSlot(seat, slotValue) {
    console.log('[Reserve] Attempting reservation for seat:', seat, 'stIdxFull:', slotValue);
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
          stIdxFull: slotValue
          },
        stIdxFull: slotValue,
        })
      });

      const data = await readJsonResponse(response);
      console.log('[Reserve] Response:', { status: response.status, ok: response.ok, data });

      if (!response.ok || data.result !== 'success') {
        throw new Error(data.resMsg || data.hMsg || data.retMsg || '예약 중 오류가 발생했습니다.');
      }

    return data;
  }

  async function handleReserve(seat) {
    setSubmitting(true);

    try {
      await reserveSeatForSlot(seat, stIdxFull);
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

  function findSeatByQuery(seatList, query) {
    if (!query) return null;

    return seatList.find((seat) => (
      String(seat.seatNo) === query
      || String(seat.srt_num) === query
      || String(seat.srt_idx) === query
    )) || null;
  }

  async function fetchSeatsForSlot(slotValue) {
    const response = await fetch(`/api/seats?stIdxFull=${encodeURIComponent(slotValue)}`, { credentials: 'same-origin' });
    const data = await readJsonResponse(response);

    if (!response.ok || data.result !== 'success') {
      if (response.status === 401) {
        router.replace('/login');
        return [];
      }

      throw new Error(data.resMsg || data.hMsg || '좌석 정보를 가져오지 못했습니다.');
    }

    return data.seats || [];
  }

  async function runAutoReserveAllSlots(seatQuery) {
    setSubmitting(true);

    const results = [];
    try {
      for (const slot of studyRoomSlots) {
        const slotSeats = await fetchSeatsForSlot(slot.value);
        const targetSeat = findSeatByQuery(slotSeats, seatQuery);

        if (!targetSeat) {
          results.push(`${slot.label}: 좌석 없음`);
          continue;
        }

        if (targetSeat.status !== 'available') {
          results.push(`${slot.label}: 예약 불가`);
          continue;
        }

        try {
          await reserveSeatForSlot(targetSeat, slot.value);
          results.push(`${slot.label}: 성공`);
        } catch (error) {
          results.push(`${slot.label}: ${error.message || '실패'}`);
        }
      }

      const successCount = results.filter((result) => result.endsWith('성공')).length;
      setAutoReserveStatus(results.join(' / '));
      setMessage(`자동 예약 완료: ${successCount}/${studyRoomSlots.length}개 타임 성공`);
      setMessageType(successCount > 0 ? 'success' : 'error');
      await loadSeats();
    } catch (error) {
      setAutoReserveStatus(error.message || '자동 예약 중 오류가 발생했습니다.');
      setMessage(error.message || '자동 예약 중 오류가 발생했습니다.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  }

  function cancelAutoReserve() {
    if (autoReserveTimerRef.current) {
      clearTimeout(autoReserveTimerRef.current);
      autoReserveTimerRef.current = null;
    }

    setAutoReserveStatus('자동 예약 대기를 취소했습니다.');
  }

  function scheduleAutoReserve() {
    if (!isMaster) {
      setAutoReserveStatus('마스터만 자동 예약을 설정할 수 있습니다.');
      return;
    }

    const seatQuery = autoReserveSeatNo.trim();
    if (!seatQuery) {
      setAutoReserveStatus('좌석 번호를 입력해 주세요.');
      return;
    }

    const targetTime = new Date(autoReserveAt);
    const delay = targetTime.getTime() - Date.now();
    if (!autoReserveAt || Number.isNaN(targetTime.getTime()) || delay <= 0) {
      setAutoReserveStatus('현재보다 이후의 예약 시각을 선택해 주세요.');
      return;
    }

    cancelAutoReserve();
    autoReserveTimerRef.current = window.setTimeout(() => {
      autoReserveTimerRef.current = null;
      setAutoReserveStatus(`${seatQuery}번 좌석 자동 예약 요청을 모든 타임에 보냅니다.`);
      runAutoReserveAllSlots(seatQuery);
    }, delay);

    setAutoReserveStatus(`${seatQuery}번 좌석을 ${formatTime(targetTime.toISOString())}에 모든 타임 예약 대기 중입니다.`);
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

      const data = await readJsonResponse(response);

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
    if (activeService === 'classroom') {
      loadClassroomBuildings();
      if (selectedBuilding) {
        loadClassroomRooms(selectedBuilding);
      }
      setMessage('교과교실 정보를 다시 불러왔습니다.');
      setMessageType('info');
      return;
    }

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
    const data = await readJsonResponse(response);

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
        <div className="eyebrow">Fastintra Reservation</div>
        <h1>New FASTINTRA</h1>
        <p>
          도서관 좌석과 교과교실 신청을 한 화면에서 처리합니다.
        </p>

        <div className="hero-metrics">
          {activeService === 'library' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="metric">
                <span>동</span>
                <strong>{classroomBuildings.length}</strong>
              </div>
              <div className="metric">
                <span>교실</span>
                <strong>{classroomRooms.length}</strong>
              </div>
              <div className="metric">
                <span>선택 타임</span>
                <strong>{selectedSlotLabel}</strong>
              </div>
              <div className="metric">
                <span>선택 교실</span>
                <strong>{selectedClassroom?.roomName || '-'}</strong>
              </div>
            </>
          )}
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
            <h2 className="section-title">신청 메뉴</h2>
            <div className="mode-tabs">
              <button
                type="button"
                className={`mode-tab ${activeService === 'library' ? 'active' : ''}`}
                onClick={() => setActiveService('library')}
              >
                도서관 신청
              </button>
              <button
                type="button"
                className={`mode-tab ${activeService === 'classroom' ? 'active' : ''}`}
                onClick={() => setActiveService('classroom')}
              >
                교과교실 신청
              </button>
            </div>
          </div>

          <div className="search-row">
            <h2 className="section-title">타임 선택</h2>
            <div className="slot-list">
              {studyRoomSlots.map((slot) => (
                <label key={slot.value} className={`slot-item ${stIdxFull === slot.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="stIdxFull"
                    value={slot.value}
                    checked={stIdxFull === slot.value}
                    onChange={(event) => setStIdxFull(event.target.value)}
                  />
                  <span>
                    <strong>{slot.label}</strong>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {activeService === 'library' ? (
            <>
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

              {isMaster ? (
                <div className="status-box">
                  <h3>마스터 자동 예약</h3>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="autoReserveSeatNo">좌석 번호</label>
                    <input
                      id="autoReserveSeatNo"
                      value={autoReserveSeatNo}
                      onChange={(event) => setAutoReserveSeatNo(event.target.value)}
                      placeholder="예: 2-81"
                    />
                  </div>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="autoReserveAt">예약 요청 시각</label>
                    <input
                      id="autoReserveAt"
                      type="datetime-local"
                      value={autoReserveAt}
                      onChange={(event) => setAutoReserveAt(event.target.value)}
                    />
                  </div>
                  <div className="inline-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="button button-primary" onClick={scheduleAutoReserve}>
                      자동 예약 설정
                    </button>
                    <button type="button" className="button button-muted" onClick={cancelAutoReserve}>
                      취소
                    </button>
                  </div>
                  <p style={{ marginTop: 10 }}>{autoReserveStatus || '탭이 열려 있는 동안 지정 시각에 가능한 모든 타임으로 예약 요청을 보냅니다.'}</p>
                </div>
              ) : null}

              <div className="status-box">
                <h3>기기 등록</h3>
                <p style={{ marginBottom: 12 }}>
                  도서관 신청은 마지막으로 등록한 기기 한 곳에서만 가능하도록 동작합니다.
                </p>
                <button type="button" className="button button-primary" onClick={handleDeviceRegister}>
                  {deviceRegistered ? '기기 재등록' : '기기 등록'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="search-row">
                <h2 className="section-title">동 선택</h2>
                <div className="floor-tabs">
                  {classroomBuildings.map((building) => (
                    <button
                      key={building.slgNum}
                      type="button"
                      className={`floor-tab ${selectedBuilding === building.slgNum ? 'active' : ''}`}
                      onClick={() => setSelectedBuilding(building.slgNum)}
                    >
                      {building.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="search-row">
                <h2 className="section-title">교실 검색</h2>
                <div className="inline-actions">
                  <input
                    value={classroomSearch}
                    onChange={(event) => setClassroomSearch(event.target.value)}
                    placeholder="A301, 자동승인,.. 검색"
                  />
                  <button type="button" className="button button-muted" onClick={() => setClassroomSearch('')}>
                    초기화
                  </button>
                </div>
              </div>

              <div className="summary-card">
                <small>현재 선택</small>
                <strong>{selectedClassroom?.roomName || '-'}</strong>
                <div className="summary-row">
                  <span>동</span>
                  <span>{selectedClassroom?.buildingName || classroomBuildings.find((building) => building.slgNum === selectedBuilding)?.name || '-'}</span>
                </div>
                <div className="summary-row">
                  <span>타임</span>
                  <span>{selectedSlotLabel}</span>
                </div>
                <div className="summary-row">
                  <span>시간</span>
                  <span>{selectedClassroom ? `${selectedClassroom.stTime || '-'} - ${selectedClassroom.edTime || '-'}` : '-'}</span>
                </div>
                <div className="summary-row">
                  <span>신청 번호</span>
                  <span>{classroomRequest?.crt_idx || selectedClassroom?.crtIdx || '-'}</span>
                </div>
              </div>

              <div className="status-box">
                <h3>교과교실 상세</h3>
                <p>담당교사: {classroomInfo?.teachers?.map((teacher) => teacher.crc_mem_name).filter(Boolean).join(', ') || '-'}</p>
                <p>승인 방식: {selectedClassroom?.approvalName || '-'}</p>
                <p>담임 승인: {selectedClassroom?.teacherApprovalName || '-'}</p>
                {classroomRequest || selectedClassroom?.crtIdx ? (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => handleClassroomCancel()}
                    disabled={submitting}
                    style={{ marginTop: 12 }}
                  >
                    교과교실 신청 취소
                  </button>
                ) : null}
              </div>
            </>
          )}

          <div className="status-box">
            <h3>상태 메시지</h3>
            <p className={messageType === 'error' ? 'toast error' : 'toast'}>{message || '항목을 선택해 보세요.'}</p>
          </div>

          <div className="status-box">
            <h3>예약 규칙</h3>
            <p>
              선택한 메뉴와 타임에 따라 신청 가능한 항목이 분리됩니다.
            </p>
          </div>
        </aside>

        <section className="panel map-panel">
          {activeService === 'library' ? (
            <>
              <div className="map-header">
                <div>
                  <h2>도서관 좌석 배치</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                    선택한 타임({selectedSlotLabel})에 따라 좌석 상태가 분리됩니다.
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
            </>
          ) : (
            <>
              <div className="map-header">
                <div>
                  <h2>교과교실 신청</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                    {selectedSlotLabel}에 신청 가능한 교과교실을 선택합니다.
                  </p>
                </div>
                <div className="legend">
                  <div className="legend-item"><span className="legend-swatch" style={{ background: '#e7f8ee' }} /> 신청 가능</div>
                  <div className="legend-item"><span className="legend-swatch" style={{ background: '#f3f4f6' }} /> 정보</div>
                </div>
              </div>

              {classroomLoading ? (
                <div className="loading-state">교과교실 데이터를 불러오는 중입니다...</div>
              ) : filteredClassroomRooms.length === 0 ? (
                <div className="empty-state">
                  <strong>표시할 교과교실이 없습니다.</strong>
                  <p>타임이나 동을 바꿔 다시 확인해 주세요.</p>
                </div>
              ) : (
                <div className="classroom-grid">
                  {filteredClassroomRooms.map((room) => {
                    const isSelected = selectedClassroom?.crIdx === room.crIdx && selectedClassroom?.stIdx === room.stIdx;
                    return (
                      <article key={`${room.crIdx}-${room.stIdx}`} className={`classroom-card ${isSelected ? 'selected' : ''}`}>
                        <button type="button" className="classroom-card-main" onClick={() => loadClassroomInfo(room)}>
                          <div>
                            <strong>{room.roomName || room.roomCode}</strong>
                            <span>{room.buildingName} · {room.stName || selectedSlotLabel}</span>
                          </div>
                          <div className="classroom-time">{room.stTime || '-'} - {room.edTime || '-'}</div>
                        </button>
                        <div className="classroom-meta">
                          <span>{room.approvalName || '승인 정보 없음'}</span>
                          <span>{room.teacherApprovalName || '-'}</span>
                        </div>
                        {room.crtIdx ? (
                          <button
                            type="button"
                            className="button button-danger"
                            onClick={() => {
                              setSelectedClassroom(room);
                              setClassroomRequest({ crt_idx: room.crtIdx, ...room.remote });
                              handleClassroomCancel({ crt_idx: room.crtIdx, ...room.remote }, room);
                            }}
                            disabled={submitting}
                          >
                            취소
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button-primary"
                            onClick={() => handleClassroomApply(room)}
                            disabled={submitting || !room.selectable}
                          >
                            신청
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
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
              <div className="detail-section">
                <h4>기본 정보</h4>
                <SeatDetailItem label="좌석 번호" value={selectedSeatDetail.seatNo} />
                <SeatDetailItem label="상태" value={STATUS_COPY[selectedSeatDetail.status] || selectedSeatDetail.status} />
                <SeatDetailItem label="예약자" value={selectedSeatDetail.requesterName} />
                <SeatDetailItem label="선택 타임" value={selectedSeatDetail.stIdxFull || stIdxFull} />
              </div>

              <div className="detail-section">
                <h4>예약/요청 값</h4>
                <SeatDetailItem label="예약 ID (sre_idx)" value={selectedSeatDetail.sre_idx} />
                <SeatDetailItem label="좌석 ID (srt_idx)" value={selectedSeatDetail.srt_idx} />
                <SeatDetailItem label="구역 ID (clr_idx)" value={selectedSeatDetail.clr_idx} />
                <SeatDetailItem label="내 예약 여부 (myYn)" value={selectedSeatDetail.myYn} />
              </div>

              <div className="detail-section">
                <h4>좌석 원본 정보</h4>
                <SeatDetailItem label="원본 번호 (srt_num)" value={selectedSeatDetail.srt_num} />
                <SeatDetailItem label="표시명 (srt_cont)" value={selectedSeatDetail.remote?.srt_cont} />
                <SeatDetailItem label="타입 (srt_type)" value={selectedSeatDetail.srt_type} />
                <SeatDetailItem label="사용 여부 (srt_use_yn)" value={selectedSeatDetail.srt_use_yn} />
                <SeatDetailItem label="좌표 X (srt_x)" value={selectedSeatDetail.srt_x} />
                <SeatDetailItem label="좌표 Y (srt_y)" value={selectedSeatDetail.srt_y} />
              </div>

              <div className="detail-section">
                <h4>장소/원격 응답</h4>
                <SeatDetailItem label="장소 코드" value={selectedSeatDetail.c_place_cd} />
                <SeatDetailItem label="장소 이름" value={selectedSeatDetail.c_place_cd_name} />
                <SeatDetailItem label="휴일 여부 (holidayYn)" value={selectedSeatDetail.remote?.holidayYn} />
                <SeatDetailItem label="원본 학번 (sre_std_num)" value={selectedSeatDetail.remote?.sre_std_num} />
                <SeatDetailItem label="원본 이름 (memName)" value={selectedSeatDetail.remote?.memName} />
              </div>

              <div className="detail-section">
                <h4>UI 상태</h4>
                <SeatDetailItem label="예약 가능 클릭" value={selectedSeatDetail.clickable} />
                <SeatDetailItem label="취소 표시" value={selectedSeatDetail.showCancel} />
                <SeatDetailItem label="예약됨 표시" value={selectedSeatDetail.showReserved} />
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
