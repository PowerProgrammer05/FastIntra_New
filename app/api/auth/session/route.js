import { NextResponse } from 'next/server';
import { getSessionById, getSessionIdFromRequest } from '../../../../lib/session-store';

export async function GET(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ result: 'fail', authenticated: false }, { status: 401 });
  }

  const isMaster = session.memId === 'VanHalen';

  return NextResponse.json({
    result: 'success',
    authenticated: true,
    isMaster,
    session: {
      memId: session.memId,
      status: session.status || 'authenticated',
      hasAuthToken: !!session.authToken,
      loginResponse: session.loginResponse || null,
      isMaster
    }
  });
}
