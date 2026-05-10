import { NextResponse } from 'next/server';
import { COOKIE_NAME, deleteSession, getSessionCookieOptions, getSessionIdFromRequest } from '../../../../lib/session-store';

export async function POST(request) {
  const sessionId = getSessionIdFromRequest(request);
  await deleteSession(sessionId);

  const response = NextResponse.json({ result: 'success' });
  response.cookies.set(COOKIE_NAME, '', { ...getSessionCookieOptions(), maxAge: 0 });
  return response;
}
