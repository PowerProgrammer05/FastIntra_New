import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../../lib/session-store';

const CLASSROOM_HISTORY_REFERER = 'https://hh.hana.hs.kr/main/classroom/history.do';

export async function POST(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const crtIdx = Number(body.crtIdx || body.crt_idx || body.request?.crt_idx || 0);

  if (!crtIdx) {
    return NextResponse.json({ result: 'fail', resMsg: '취소할 교과교실 신청 정보가 없습니다.' }, { status: 400 });
  }

  const { response, json } = await fetchRemoteJson('/main/classroom/apply-cancel.do', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: CLASSROOM_HISTORY_REFERER,
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded'
    }),
    body: formBody({ crt_idx: crtIdx })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  return NextResponse.json(json || { result: 'fail', resMsg: '교과교실 취소 응답을 확인할 수 없습니다.' }, {
    status: response.status || 200
  });
}
