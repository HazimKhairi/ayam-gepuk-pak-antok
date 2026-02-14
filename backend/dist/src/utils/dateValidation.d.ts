/**
 * Parse and validate a booking date string (YYYY-MM-DD).
 * Defaults to today if no dateString provided.
 * Throws 'PAST_DATE' or 'DATE_TOO_FAR' on invalid dates.
 */
export declare function parseAndValidateBookingDate(dateString?: string): Date;
/**
 * Check if a time slot is within outlet operating hours.
 * @param slotTime - Time in HH:mm format (e.g., "14:30")
 * @param openTime - Opening time in HH:mm format (e.g., "10:00")
 * @param closeTime - Closing time in HH:mm format (e.g., "22:00")
 * @returns true if slot time is within hours, false otherwise
 */
export declare function isTimeWithinOutletHours(slotTime: string, openTime: string, closeTime: string): boolean;
//# sourceMappingURL=dateValidation.d.ts.map