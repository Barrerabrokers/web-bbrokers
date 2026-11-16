export const MEET_EMAIL_NOTICE = 'La invitación llega por mail con el link de Meet.';

export function verifiedMeetUrl(value: unknown) {
  return typeof value === 'string' && /^https:\/\/meet\.google\.com\/[a-z-]+$/.test(value) ? value : null;
}
