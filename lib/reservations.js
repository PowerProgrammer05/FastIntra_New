import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, '[]', 'utf8');
  }
}

export async function readReservations() {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw || '[]');

  return Array.isArray(parsed) ? parsed : [];
}

export async function saveReservations(reservations) {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
}

export function normalizeStudyRoomSlot(stIdxFull) {
  return String(stIdxFull || '').trim();
}

export function sanitizeUserId(userId) {
  return String(userId || '').trim();
}

export function sanitizeUserName(userName) {
  return String(userName || '').trim();
}