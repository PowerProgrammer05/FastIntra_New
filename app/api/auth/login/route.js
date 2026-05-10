import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemote,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { COOKIE_NAME, createSession } from '../../../../lib/session-store';

async function primeRemoteCookies() {
  const response = await fetchRemote('/main/login/login.do', {
    method: 'GET',
    headers: buildRemoteHeaders({ isAjax: false, referer: 'https://hh.hana.hs.kr/main/login/login.do' })
  });

  return mergeCookieHeader('', getSetCookieLines(response.headers));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const memId = String(body.memId || body.mem_id || '').trim();
  const memPwd = String(body.memPwd || body.mem_pwd || '').trim();

  if (!memId || !memPwd) {
    return NextResponse.json({ result: 'fail', resMsg: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
  }

  const primedCookieHeader = await primeRemoteCookies();

  const { response, json } = await fetchRemoteJson('/main/login/auth/login', {
    method: 'POST',
    headers: buildRemoteHeaders({
      cookieHeader: primedCookieHeader,
      referer: 'https://hh.hana.hs.kr/main/login/login.do',
      origin: 'https://hh.hana.hs.kr',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: formBody({ mem_id: memId, mem_pwd: memPwd })
  });

  const remoteCookieHeader = mergeCookieHeader(primedCookieHeader, getSetCookieLines(response.headers));
  const responseData = json || { result: 'fail', resMsg: '로그인 응답을 확인할 수 없습니다.' };

  if (String(responseData.responseMessage || '') === 'LOGIN_SUCCESS') {
    const { sessionId } = await createSession({
      memId,
      memPwd: '',
      remoteCookieHeader,
      loginResponse: responseData,
      authToken: responseData?.AUTH_TOKEN?.ACCESS_TOKEN || '',
      status: 'authenticated'
    });

    const nextResponse = NextResponse.json({
      result: 'success',
      ...responseData,
      session: {
        memId,
        isNewEnv: !!responseData.isNewEnv,
        isChgPwd: !!responseData.isChgPwd
      }
    });

    nextResponse.cookies.set(COOKIE_NAME, sessionId, getSessionCookieOptions());
    return nextResponse;
  }

  return NextResponse.json(
    {
      result: 'fail',
      ...responseData,
      resMsg: responseData.resMsg || responseData.message || '로그인에 실패했습니다.'
    },
    { status: response.status || 200 }
  );
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
}
