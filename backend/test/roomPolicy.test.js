const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getJoinPolicy,
  getRoomWindow,
  shouldRefundFully,
} = require('../src/services/roomPolicy');

const makeTraining = (startAt, overrides = {}) => ({
  id: 'training-1',
  startAt,
  durationMin: 60,
  status: 'SCHEDULED',
  ...overrides,
});

test('trainer can join 10 minutes before start, but not earlier', () => {
  const startAt = new Date('2026-05-01T12:00:00.000Z');
  const training = makeTraining(startAt);

  const tooEarly = getJoinPolicy({
    training,
    isTrainer: true,
    hasConfirmedBooking: false,
    now: new Date('2026-05-01T11:49:59.000Z'),
  });
  assert.equal(tooEarly.canJoin, false);
  assert.match(tooEarly.reason, /10 минут/);

  const open = getJoinPolicy({
    training,
    isTrainer: true,
    hasConfirmedBooking: false,
    now: new Date('2026-05-01T11:50:00.000Z'),
  });
  assert.equal(open.canJoin, true);
});

test('student can join 5 minutes before start only with confirmed booking', () => {
  const startAt = new Date('2026-05-01T12:00:00.000Z');
  const training = makeTraining(startAt);

  const withoutBooking = getJoinPolicy({
    training,
    isTrainer: false,
    hasConfirmedBooking: false,
    now: new Date('2026-05-01T11:55:00.000Z'),
  });
  assert.equal(withoutBooking.canJoin, false);
  assert.match(withoutBooking.reason, /подтверждённой записи/);

  const tooEarly = getJoinPolicy({
    training,
    isTrainer: false,
    hasConfirmedBooking: true,
    now: new Date('2026-05-01T11:54:59.000Z'),
  });
  assert.equal(tooEarly.canJoin, false);
  assert.match(tooEarly.reason, /5 минут/);

  const open = getJoinPolicy({
    training,
    isTrainer: false,
    hasConfirmedBooking: true,
    now: new Date('2026-05-01T11:55:00.000Z'),
  });
  assert.equal(open.canJoin, true);
});

test('room window exposes start deadline and scheduled midpoint', () => {
  const startAt = new Date('2026-05-01T12:00:00.000Z');
  const window = getRoomWindow(makeTraining(startAt, { durationMin: 90 }), startAt);

  assert.equal(window.trainerJoinAt.toISOString(), '2026-05-01T11:50:00.000Z');
  assert.equal(window.studentJoinAt.toISOString(), '2026-05-01T11:55:00.000Z');
  assert.equal(window.startDeadlineAt.toISOString(), '2026-05-01T12:05:00.000Z');
  assert.equal(window.midpointAt.toISOString(), '2026-05-01T12:45:00.000Z');
});

test('trainer disconnect refund is full before midpoint and partial after midpoint', () => {
  const training = makeTraining(new Date('2026-05-01T12:00:00.000Z'), { durationMin: 60 });

  assert.equal(shouldRefundFully(training, new Date('2026-05-01T12:29:59.000Z')), true);
  assert.equal(shouldRefundFully(training, new Date('2026-05-01T12:30:00.000Z')), false);
});

test('cancelled and finished trainings cannot be joined', () => {
  for (const status of ['CANCELLED', 'FINISHED']) {
    const policy = getJoinPolicy({
      training: makeTraining(new Date('2026-05-01T12:00:00.000Z'), { status }),
      isTrainer: true,
      hasConfirmedBooking: false,
      now: new Date('2026-05-01T12:00:00.000Z'),
    });

    assert.equal(policy.canJoin, false);
  }
});
