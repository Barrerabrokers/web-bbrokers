import { MIA_MEETING_ZONE, type Slot } from '@/lib/mia-meeting-policy';

const localDay = new Intl.DateTimeFormat('es-AR', {
  timeZone: MIA_MEETING_ZONE, weekday: 'long', day: 'numeric', month: 'long',
});
const localTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: MIA_MEETING_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function meetingDayLabel(date: Date) {
  const parts = Object.fromEntries(localDay.formatToParts(date).map(({type, value}) => [type, value]));
  return `${parts.weekday} ${parts.day} de ${parts.month}`;
}

export function meetingTimeLabel(date: Date) {
  return localTime.format(date);
}

export function pilotSlotLabel(slot: Slot) {
  const date = new Date(slot.start);
  return `${meetingDayLabel(date)}, ${meetingTimeLabel(date)}`;
}
