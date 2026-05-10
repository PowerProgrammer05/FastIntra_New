import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../lib/session-store';

function ensureSeatPayload(body) {
  const seat = body.seat || body;
  return {
    srtIdx: Number(seat.srt_idx || seat.srtIdx || seat.seatIdx || 0),
    clrIdx: Number(seat.clr_idx || seat.clrIdx || 0),
    sreIdx: Number(seat.sre_idx || seat.sreIdx || 0),
    stIdxFull: String(seat.stIdxFull || body.stIdxFull || '').trim()
  };
}

export async function POST(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { srtIdx, clrIdx, stIdxFull } = ensureSeatPayload(body);

  if (!srtIdx || !clrIdx || !stIdxFull) {
    return NextResponse.json({ result: 'fail', resMsg: '좌석 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const { response, json } = await fetchRemoteJson('/main/library/study-room-req.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/library/library-apply.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: formBody({ clrIdx, srtIdx, stIdxFull })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  return NextResponse.json(json || { result: 'fail', resMsg: '예약 응답을 확인할 수 없습니다.' }, {
    status: response.status || 200
  });
}

export async function DELETE(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const seat = body.seat || body;
  const sreIdx = Number(seat.sre_idx || seat.sreIdx || body.sreIdx || 0);

  console.log('[DELETE] Body:', body);
  console.log('[DELETE] Seat:', seat);
  console.log('[DELETE] sreIdx:', sreIdx);

  if (!sreIdx) {
    console.error('[DELETE] Missing sreIdx - returning 400 error');
    return NextResponse.json({ 
      result: 'fail', 
      resMsg: '취소할 예약 정보가 없습니다.',
      debug: { body, seat, sreIdx }
    }, { status: 400 });
  }

  console.log('[DELETE] Calling remote API with sreIdx:', sreIdx);

  const { response, json } = await fetchRemoteJson('/main/studyroom/study-cancel.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/library/library-apply.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: formBody({ sreIdx })
  });

  console.log('[DELETE] Remote response:', { status: response.status, json });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  return NextResponse.json(json || { result: 'fail', resMsg: '취소 응답을 확인할 수 없습니다.' }, {
    status: response.status || 200
  });
}