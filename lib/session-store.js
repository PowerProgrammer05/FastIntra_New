import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.FASTINTRA_DATA_DIR
  || (process.env.VERCEL ? path.join('/tmp', 'fastintra-data') : path.join(process.cwd(), 'data'));
const SESSION_FILE = path.join(DATA_DIR, 'auth-sessions.json');
const COOKIE_NAME = 'fastintra_sid';
let cachedSessions = null;
let sessionWriteQueue = Promise.resolve();

async function withSessionLock(operation) {
  const run = sessionWriteQueue.then(operation, operation);
  sessionWriteQueue = run.catch(() => {});
  return run;
}

async function ensureSessionFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(SESSION_FILE, 'utf8');
  } catch {
    await writeFile(SESSION_FILE, '{}', 'utf8');
  }
}

async function readAllSessions() {
  await ensureSessionFile();
  const raw = await readFile(SESSION_FILE, 'utf8');

  try {
    const parsed = JSON.parse(raw || '{}');
    cachedSessions = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    return cachedSessions;
  } catch {
    return cachedSessions || {};
  }
}

async function writeAllSessions(sessions) {
  await ensureSessionFile();
  cachedSessions = sessions;

  const tempFile = `${SESSION_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, JSON.stringify(sessions, null, 2), 'utf8');
  await rename(tempFile, SESSION_FILE);
}

export function getSessionIdFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';

  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((pair) => pair.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1) || '';
}

export async function getSessionById(sessionId) {
  if (!sessionId) return null;

  const sessions = await readAllSessions();
  return sessions[sessionId] || null;
}

export async function createSession(sessionData) {
  return withSessionLock(async () => {
    const sessions = await readAllSessions();
    const sessionId = randomUUID();

    sessions[sessionId] = {
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await writeAllSessions(sessions);
    return { sessionId, session: sessions[sessionId] };
  });
}

export async function updateSession(sessionId, patch) {
  if (!sessionId) return null;

  return withSessionLock(async () => {
    const sessions = await readAllSessions();
    if (!sessions[sessionId]) return null;

    sessions[sessionId] = {
      ...sessions[sessionId],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await writeAllSessions(sessions);
    return sessions[sessionId];
  });
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;

  await withSessionLock(async () => {
    const sessions = await readAllSessions();
    delete sessions[sessionId];
    await writeAllSessions(sessions);
  });
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
}

export { COOKIE_NAME };
