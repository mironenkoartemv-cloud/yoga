export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  BOOKED: 'booked',
  CAN_JOIN: 'can_join',
  LIVE: 'live',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

export function getBookingFlowStatus(booking, now = new Date()) {
  if (!booking) return null

  const training = booking.training
  const startAt = training?.startAt ? new Date(training.startAt) : null
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt) : null
  const minutesUntil = startAt ? Math.floor((startAt.getTime() - now.getTime()) / (1000 * 60)) : null

  if (booking.status === 'CANCELLED' || training?.status === 'CANCELLED') return BOOKING_STATUS.CANCELLED
  if (training?.status === 'FINISHED' || (startAt && startAt < now && training?.status !== 'LIVE')) return BOOKING_STATUS.FINISHED
  if (booking.status === 'PENDING') {
    return expiresAt && expiresAt <= now ? BOOKING_STATUS.EXPIRED : BOOKING_STATUS.PENDING_PAYMENT
  }
  if (booking.status !== 'CONFIRMED') return null
  if (training?.status === 'LIVE') return BOOKING_STATUS.LIVE
  if (training?.status === 'SCHEDULED' && minutesUntil !== null && minutesUntil <= 5) return BOOKING_STATUS.CAN_JOIN

  return BOOKING_STATUS.BOOKED
}

export function canCancelConfirmedBooking(booking, now = new Date()) {
  if (!booking || booking.status !== 'CONFIRMED') return false
  if (booking.training?.status !== 'SCHEDULED') return false

  const startAt = new Date(booking.training.startAt)
  const minutesUntil = Math.floor((startAt.getTime() - now.getTime()) / (1000 * 60))
  return minutesUntil >= 30
}
