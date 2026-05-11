import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.FASTINTRA_DATA_DIR
  || (process.env.VERCEL ? path.join('/tmp', 'fastintra-data') : path.join(process.cwd(), 'data'));
const SESSION_FILE = path.join(DATA_DIR, 'auth-sessions.json');
const COOKIE_NAME = 'fastintra_sid';
let cachedSessions = null;
let sessionWriteQueue = Promise.resolve();
const fallbackSessions = new Map();

function getSessionSecret() {
  return createHash('sha256')
    .update(process.env.FASTINTRA_SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'fastintra-local-session-secret')
    .digest();
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function getPortableSession(sessionId, session = {}) {
  return {
    sessionId,
    session: {
      memId: session.memId || '',
      remoteCookieHeader: session.remoteCookieHeader || '',
      authToken: session.authToken || '',
      status: session.status || 'authenticated',
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: session.updatedAt || new Date().toISOString()
    }
  };
}

function sealSession(sessionId, session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getSessionSecret(), iv);
  const payload = Buffer.from(JSON.stringify(getPortableSession(sessionId, session)), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [sessionId, toBase64Url(iv), toBase64Url(tag), toBase64Url(encrypted)].join('.');
}

function unsealSession(cookieValue) {
  const parts = String(cookieValue || '').split('.');
  if (parts.length !== 4) return null;

  try {
    const [sessionId, ivValue, tagValue, encryptedValue] = parts;
    const decipher = createDecipheriv('aes-256-gcm', getSessionSecret(), fromBase64Url(ivValue));
    decipher.setAuthTag(fromBase64Url(tagValue));
    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(encryptedValue)),
      decipher.final()
    ]);
    const parsed = JSON.parse(decrypted.toString('utf8'));

    if (!parsed?.sessionId || !parsed?.session?.remoteCookieHeader) return null;
    return { sessionId: parsed.sessionId || sessionId, session: parsed.session };
  } catch {
    return null;
  }
}

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

  const cookieValue = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((pair) => pair.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1) || '';

  const decodedCookieValue = decodeURIComponent(cookieValue);
  const sealed = unsealSession(decodedCookieValue);
  if (sealed) {
    fallbackSessions.set(sealed.sessionId, sealed.session);
    return sealed.sessionId;
  }

  return decodedCookieValue;
}

export async function getSessionById(sessionId) {
  if (!sessionId) return null;

  const sessions = await readAllSessions();
  return sessions[sessionId] || fallbackSessions.get(sessionId) || null;
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
    fallbackSessions.set(sessionId, sessions[sessionId]);
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
    fallbackSessions.set(sessionId, sessions[sessionId]);
    return sessions[sessionId];
  });
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;

  await withSessionLock(async () => {
    const sessions = await readAllSessions();
    delete sessions[sessionId];
    fallbackSessions.delete(sessionId);
    await writeAllSessions(sessions);
  });
}

export function getSessionCookieValue(sessionId, session) {
  return sealSession(sessionId, session);
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
