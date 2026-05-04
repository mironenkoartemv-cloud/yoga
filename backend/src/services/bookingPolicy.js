const BOOKING_PAYMENT_HOLD_MIN = 15;
const CANCEL_WITH_REFUND_BEFORE_MIN = 30;

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const getBookingExpiry = (now = new Date()) => addMinutes(now, BOOKING_PAYMENT_HOLD_MIN);

const isPendingBookingActive = (booking, now = new Date()) => {
  if (!booking || booking.status !== 'PENDING') return false;
  return !booking.expiresAt || new Date(booking.expiresAt) > now;
};

const canCancelWithRefund = (training, now = new Date()) => {
  if (!training || training.status !== 'SCHEDULED') return false;
  const minutesUntilStart = (new Date(training.startAt) - now.getTime()) / (1000 * 60);
  return minutesUntilStart >= CANCEL_WITH_REFUND_BEFORE_MIN;
};

module.exports = {
  BOOKING_PAYMENT_HOLD_MIN,
  CANCEL_WITH_REFUND_BEFORE_MIN,
  getBookingExpiry,
  isPendingBookingActive,
  canCancelWithRefund,
};
