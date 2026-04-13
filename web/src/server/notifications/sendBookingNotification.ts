import type { BookingInput } from '../booking/validateBooking'

export const sendBookingNotification = async (_booking: BookingInput) => {
  // Stub for email/SMS/Telegram notifications.
  return true
}
