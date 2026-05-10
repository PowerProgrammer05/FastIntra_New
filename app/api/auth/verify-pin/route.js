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

  if (!session) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const memPinNum = String(body.memPinNum || '').trim();
  const newEnv = body.newEnv !== false;

  if (memPinNum.length !== 6) {
    return NextResponse.json({ result: 'fail', resMsg: '본인확인번호 6자리를 입력해 주세요.' }, { status: 400 });
  }

  const { response, json } = await fetchRemoteJson('/main/login/auth/verifyPin', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: session.remoteCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/login/login.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      authorization: session.authToken ? `Bearer ${session.authToken}` : undefined
    }),
    body: formBody({ memPinNum, newEnv: String(newEnv) })
  });

  const remoteCookieHeader = mergeCookieHeader(session.remoteCookieHeader, getSetCookieLines(response.headers));
  await updateSession(sessionId, {
    remoteCookieHeader,
    pinVerifiedAt: new Date().toISOString(),
    status: 'authenticated'
  });

  const responseData = json || {};

  if (responseData.result === false || responseData.result === 'fail') {
    return NextResponse.json({ result: 'fail', ...responseData }, { status: 400 });
  }

  return NextResponse.json({ result: 'success', ...responseData });
}
