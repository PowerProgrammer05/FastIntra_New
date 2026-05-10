const SEOUL_TIME_ZONE = 'Asia/Seoul';

export const WEEKDAY_STUDY_ROOM_SLOTS = [
  { value: '2_8', label: '0타임' },
  { value: '2_9', label: '1타임' },
  { value: '2_10', label: '2타임' }
];

export const WEEKEND_STUDY_ROOM_SLOTS = [
  { value: '4_12', label: '1타임' },
  { value: '4_13', label: '2타임' },
  { value: '4_14', label: '3타임' },
  { value: '4_15', label: '4타임' }
];

export const STUDY_ROOM_SLOTS = WEEKDAY_STUDY_ROOM_SLOTS;

function getConfiguredHolidaySet() {
  const env = typeof process !== 'undefined' ? process.env : {};
  const raw = env.NEXT_PUBLIC_FASTINTRA_HOLIDAYS || env.FASTINTRA_HOLIDAYS || '';
  return new Set(
    raw
      .split(',')
      .map((date) => date.trim())
      .filter(Boolean)
  );
}

function getSeoulDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getSeoulDay(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: SEOUL_TIME_ZONE })).getDay();
}

export function isWeekendOrHoliday(date = new Date()) {
  const day = getSeoulDay(date);
  return day === 0 || day === 6 || getConfiguredHolidaySet().has(getSeoulDateKey(date));
}

export function getStudyRoomSlots(date = new Date()) {
  return isWeekendOrHoliday(date) ? WEEKEND_STUDY_ROOM_SLOTS : WEEKDAY_STUDY_ROOM_SLOTS;
}

export function getDefaultStudyRoomSlot(date = new Date()) {
  return getStudyRoomSlots(date)[0].value;
}

export function findStudyRoomSlot(value, date = new Date()) {
  const allSlots = [...WEEKDAY_STUDY_ROOM_SLOTS, ...WEEKEND_STUDY_ROOM_SLOTS];
  return allSlots.find((slot) => slot.value === value) || getStudyRoomSlots(date)[0];
}
