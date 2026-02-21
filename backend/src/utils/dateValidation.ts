const MAX_BOOKING_DAYS_AHEAD = 14;

/**
 * Parse and validate a booking date string (YYYY-MM-DD).
 * Defaults to today if no dateString provided.
 * @param minDaysAhead - Minimum days in advance required (0 = today allowed, 1 = tomorrow earliest)
 * Throws 'PAST_DATE', 'SAME_DAY_BOOKING', or 'DATE_TOO_FAR' on invalid dates.
 */
export function parseAndValidateBookingDate(dateString?: string, minDaysAhead: number = 0): Date {
  const date = dateString ? new Date(dateString) : new Date();
  date.setHours(0, 0, 0, 0);

  if (isNaN(date.getTime())) {
    throw new Error('INVALID_DATE');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    throw new Error('PAST_DATE');
  }

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + minDaysAhead);
  if (date < minDate) {
    throw new Error('SAME_DAY_BOOKING');
  }

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS_AHEAD);
  if (date > maxDate) {
    throw new Error('DATE_TOO_FAR');
  }

  return date;
}

/**
 * Check if a time slot is within outlet operating hours.
 * @param slotTime - Time in HH:mm format (e.g., "14:30")
 * @param openTime - Opening time in HH:mm format (e.g., "10:00")
 * @param closeTime - Closing time in HH:mm format (e.g., "22:00")
 * @returns true if slot time is within hours, false otherwise
 */
export function isTimeWithinOutletHours(
  slotTime: string,
  openTime: string,
  closeTime: string
): boolean {
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes; // Convert to minutes since midnight
  };

  const slotMinutes = parseTime(slotTime);
  const openMinutes = parseTime(openTime);
  const closeMinutes = parseTime(closeTime);

  return slotMinutes >= openMinutes && slotMinutes <= closeMinutes;
}
