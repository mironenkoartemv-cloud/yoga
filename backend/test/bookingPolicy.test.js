const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getBookingExpiry,
  isPendingBookingActive,
  canCancelWithRefund,
} = require('../src/services/bookingPolicy');

test('pending booking expires 15 minutes after creation', () => {
  const now = new Date('2026-05-03T10:00:00.000Z');
  assert.equal(getBookingExpiry(now).toISOString(), '2026-05-03T10:15:00.000Z');
});

test('pending booking is active until expiry', () => {
  const booking = {
    status: 'PENDING',
    expiresAt: new Date('2026-05-03T10:15:00.000Z'),
  };

  assert.equal(isPendingBookingActive(booking, new Date('2026-05-03T10:14:59.000Z')), true);
  assert.equal(isPendingBookingActive(booking, new Date('2026-05-03T10:15:00.000Z')), false);
});

test('confirmed and cancelled bookings are not active pending bookings', () => {
  assert.equal(isPendingBookingActive({ status: 'CONFIRMED' }), false);
  assert.equal(isPendingBookingActive({ status: 'CANCELLED' }), false);
});

test('full-refund cancellation is available until 30 minutes before start', () => {
  const training = { status: 'SCHEDULED', startAt: new Date('2026-05-03T12:00:00.000Z') };

  assert.equal(canCancelWithRefund(training, new Date('2026-05-03T11:30:00.000Z')), true);
  assert.equal(canCancelWithRefund(training, new Date('2026-05-03T11:30:01.000Z')), false);
});

test('cancellation with refund is not available for live or finished trainings', () => {
  const startAt = new Date('2026-05-03T12:00:00.000Z');
  const now = new Date('2026-05-03T10:00:00.000Z');

  assert.equal(canCancelWithRefund({ status: 'LIVE', startAt }, now), false);
  assert.equal(canCancelWithRefund({ status: 'FINISHED', startAt }, now), false);
  assert.equal(canCancelWithRefund({ status: 'CANCELLED', startAt }, now), false);
});
