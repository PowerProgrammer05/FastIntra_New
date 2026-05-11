import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../../lib/session-store';
import { findStudyRoomSlot } from '../../../../lib/slots';

const CLASSROOM_REFERER = 'https://hh.hana.hs.kr/main/classroom/apply.do';

export async function GET(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const stIdxFull = String(url.searchParams.get('stIdxFull') || findStudyRoomSlot().value).trim();

  const { response, json } = await fetchRemoteJson('/main/classroom/cls-plg-list.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: CLASSROOM_REFERER,
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded'
    }),
    body: formBody({ stIdxFull })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  const responseData = json || {};
  if (responseData.result !== 'success') {
    return NextResponse.json(
      { result: 'fail', resMsg: responseData.resMsg || '교과교실 동 목록을 가져오지 못했습니다.' },
      { status: response.status || 200 }
    );
  }

  const buildings = (Array.isArray(responseData.list) ? responseData.list : [])
    .filter((item) => item.slg_num && item.slg_nm)
    .map((item) => ({
      slgNum: String(item.slg_num),
      name: item.slg_nm,
      remote: item
    }));

  return NextResponse.json({
    result: 'success',
    buildings,
    list: responseData.list || [],
    stIdxFull,
    resMsg: responseData.resMsg || ''
  });
}
