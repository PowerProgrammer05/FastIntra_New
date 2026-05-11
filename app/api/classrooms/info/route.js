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

export async function GET(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const crIdx = Number(url.searchParams.get('crIdx') || 0);

  if (!crIdx) {
    return NextResponse.json({ result: 'fail', resMsg: '교실 정보를 선택해 주세요.' }, { status: 400 });
  }

  const { response, json } = await fetchRemoteJson('/main/classroom/cls-cr-info.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: CLASSROOM_REFERER,
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded'
    }),
    body: formBody({ crIdx })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  const responseData = json || {};
  if (responseData.result !== 'success') {
    return NextResponse.json(
      { result: 'fail', resMsg: responseData.resMsg || '교과교실 상세 정보를 가져오지 못했습니다.' },
      { status: response.status || 200 }
    );
  }

  const item = responseData.item || {};
  return NextResponse.json({
    result: 'success',
    item,
    teachers: Array.isArray(item.teacherList) ? item.teacherList : [],
    roomTimes: Array.isArray(item.roomTimeList) ? item.roomTimeList : [],
    resMsg: responseData.resMsg || ''
  });
}
