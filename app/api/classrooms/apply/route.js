import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../../lib/session-store';

const CLASSROOM_REFERER = 'https://hh.hana.hs.kr/main/classroom/apply.do';

export async function POST(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const room = body.room || body;
  const slgNum = String(room.slgNum || room.slg_num || '').trim();
  const crIdx = Number(room.crIdx || room.cr_idx || 0);
  const stIdxFull = String(room.stIdxFull || body.stIdxFull || '').trim();
  const crtCont = String(room.crtCont || room.crt_cont || body.crtCont || '').trim();

  if (!slgNum || !crIdx || !stIdxFull) {
    return NextResponse.json(
      { result: 'fail', resMsg: '교과교실 신청 정보가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const { response, json } = await fetchRemoteJson('/main/classroom/apply-insert.do', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: CLASSROOM_REFERER,
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded'
    }),
    body: formBody({
      slg_num: slgNum,
      cr_idx: crIdx,
      crt_cont: crtCont,
      stIdxFull2: stIdxFull
    })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  return NextResponse.json(json || { result: 'fail', resMsg: '교과교실 신청 응답을 확인할 수 없습니다.' }, {
    status: response.status || 200
  });
}
