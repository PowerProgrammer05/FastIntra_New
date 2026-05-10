import { NextResponse } from 'next/server';
import { buildRemoteHeaders, fetchRemoteJson, getSetCookieLines, mergeCookieHeader } from '../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../lib/session-store';
import { findStudyRoomSlot } from '../../../lib/slots';

function resolveSeatStatus(item) {
  const unusable = item.srt_use_yn === 'N' || item.holidayYn === 'Y';
  const mySeat = item.myYn === 'Y';
  const reserved = !!item.sre_idx && !mySeat;
  const isUsableSeat = item.srt_use_yn === 'Y';

  if (unusable) {
    return { status: 'blocked', clickable: false, showCancel: false, showReserved: false };
  }

  if (mySeat) {
    return { status: 'mine', clickable: false, showCancel: true, showReserved: false };
  }

  if (reserved) {
    return { status: 'reserved', clickable: false, showCancel: false, showReserved: true };
  }

  if (isUsableSeat) {
    return { status: 'available', clickable: true, showCancel: false, showReserved: false };
  }

  return { status: 'empty', clickable: false, showCancel: false, showReserved: false };
}

export async function GET(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const stIdxFull = String(url.searchParams.get('stIdxFull') || findStudyRoomSlot().value).trim();
  const { response, json } = await fetchRemoteJson('/main/library/study-room-req-list.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/library/library-apply.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: new URLSearchParams({ stIdxFull, subListYn: 'N', pageSize: '200' }).toString()
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  const responseData = json || {};

  if (responseData.result !== 'success') {
    return NextResponse.json(
      { result: 'fail', resMsg: responseData.resMsg || responseData.hMsg || '좌석 정보를 가져오지 못했습니다.' },
      { status: response.status || 200 }
    );
  }

  const remoteList = Array.isArray(responseData.list) ? responseData.list : [];
  const seats = remoteList.map((item) => {
    const seatStatus = resolveSeatStatus(item);
    const displayNo = item.srt_cont && item.srt_cont.trim() ? item.srt_cont : String(item.srt_num || item.srt_idx);
    
    // Infer clr_idx from srt_x coordinate if not provided
    let clrIdx = item.clr_idx;
    if (!clrIdx && String(displayNo).startsWith('2-')) {
      // Map X coordinate ranges to clr_idx for 1층 (2-xx seats)
      const srtX = item.srt_x;
      if (srtX >= 2 && srtX <= 3) {
        clrIdx = 10; // Left block
      } else if (srtX >= 4 && srtX <= 5) {
        clrIdx = 11; // Middle-left block
      } else if (srtX >= 6 && srtX <= 7) {
        clrIdx = 12; // Middle-right block
      } else if (srtX >= 8 && srtX <= 9) {
        clrIdx = 13; // Right block
      }
    } else if (!clrIdx && String(displayNo).startsWith('1-')) {
      clrIdx = 14; // 1층
    } else if (!clrIdx && String(displayNo).startsWith('2-')) {
      clrIdx = 15; // 2층
    } else if (!clrIdx && String(displayNo).startsWith('3-')) {
      clrIdx = 16; // 토의실A
    } else if (!clrIdx && String(displayNo).startsWith('4-')) {
      clrIdx = 17; // 토의실B
    }

    const mappedSeat = {
      srt_idx: item.srt_idx,
      seatNo: displayNo,
      srt_num: item.srt_num,
      srt_x: item.srt_x,
      srt_y: item.srt_y,
      srt_type: item.srt_type,
      srt_use_yn: item.srt_use_yn,
      sre_idx: item.sre_idx,
      myYn: item.myYn,
      clr_idx: clrIdx,
      c_place_cd: item.c_place_cd,
      c_place_cd_name: item.c_place_cd_name,
      requesterName: item.sre_mem_name || item.memName || item.requesterName || '',
      status: seatStatus.status,
      clickable: seatStatus.clickable,
      showCancel: seatStatus.showCancel,
      showReserved: seatStatus.showReserved
    };

    // Debug log for seats with my reservations
    if (mappedSeat.status === 'mine') {
      console.log('[Seats] My seat:', {
        seatNo: mappedSeat.seatNo,
        sre_idx: mappedSeat.sre_idx,
        srt_idx: mappedSeat.srt_idx,
        status: mappedSeat.status,
        item
      });
    }

    return mappedSeat;
  });

  // Adjust entrance positions: 1F입구 below 1-6, 2F입구 below 2-57
  const seat1_6 = seats.find((s) => String(s.seatNo).includes('1-6'));
  const seat2_57 = seats.find((s) => String(s.seatNo).includes('2-57'));
  const entrance1F = seats.find((s) => String(s.seatNo).includes('1F입구'));
  const entrance2F = seats.find((s) => String(s.seatNo).includes('2F입구'));

  if (entrance1F && seat1_6) {
    entrance1F.srt_y = seat1_6.srt_y - 1;
    entrance1F.srt_x = seat1_6.srt_x;
  }

  if (entrance2F && seat2_57) {
    entrance2F.srt_y = seat2_57.srt_y - 1;
    entrance2F.srt_x = seat2_57.srt_x;
  }

  return NextResponse.json({
    result: 'success',
    seats,
    list: remoteList,
    total: seats.length,
    reservedCount: seats.filter((seat) => seat.status === 'reserved' || seat.status === 'mine').length,
    myReservation: seats.find((seat) => seat.status === 'mine') || null,
    hYn: responseData.hYn || 'N',
    hMsg: responseData.hMsg || '',
    stIdxFull
  });
}