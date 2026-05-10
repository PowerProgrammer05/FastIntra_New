export const STUDY_ROOM_SLOTS = [
  { value: '4_12', label: '1타임' },
  { value: '4_13', label: '2타임' },
  { value: '4_14', label: '3타임' },
  { value: '4_15', label: '4타임' }
];

export function getDefaultStudyRoomSlot() {
  return STUDY_ROOM_SLOTS[0].value;
}

export function findStudyRoomSlot(value) {
  return STUDY_ROOM_SLOTS.find((slot) => slot.value === value) || STUDY_ROOM_SLOTS[0];
}