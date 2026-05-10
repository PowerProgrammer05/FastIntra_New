import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../../lib/session-store';

export async function POST(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { response, json } = await fetchRemoteJson('/main/member/updateDiviceInfo.json', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/studyroom/study-apply.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: formBody({ usegubun: 'L' })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  if (remoteCookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader });
  }

  const responseData = json || {};
  return NextResponse.json(
    {
      result: responseData.result || 'success',
      ...responseData,
      resMsg: responseData.resMsg || '기기등록 완료 하였습니다.'
    },
    { status: response.status || 200 }
  );
}