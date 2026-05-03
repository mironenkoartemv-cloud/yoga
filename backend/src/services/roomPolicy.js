const TRAINER_JOIN_BEFORE_MIN = 10;
const STUDENT_JOIN_BEFORE_MIN = 5;
const START_GRACE_MIN = 5;
const TRAINER_RECONNECT_GRACE_MIN = 5;
const POST_TRAINING_DISCOUNT_MIN = 60;
const POST_TRAINING_DISCOUNT_PERCENT = 10;

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const getRoomWindow = (training, now = new Date()) => {
  const startAt = new Date(training.startAt);
  const scheduledEndAt = addMinutes(startAt, training.durationMin);
  const trainerJoinAt = addMinutes(startAt, -TRAINER_JOIN_BEFORE_MIN);
  const studentJoinAt = addMinutes(startAt, -STUDENT_JOIN_BEFORE_MIN);
  const startDeadlineAt = addMinutes(startAt, START_GRACE_MIN);
  const midpointAt = addMinutes(startAt, training.durationMin / 2);

  return {
    startAt,
    scheduledEndAt,
    trainerJoinAt,
    studentJoinAt,
    startDeadlineAt,
    midpointAt,
    msUntilStart: startAt.getTime() - now.getTime(),
    msUntilTrainerJoin: trainerJoinAt.getTime() - now.getTime(),
    msUntilStudentJoin: studentJoinAt.getTime() - now.getTime(),
    msUntilStartDeadline: startDeadlineAt.getTime() - now.getTime(),
  };
};

const getJoinPolicy = ({ training, isTrainer, hasConfirmedBooking, now = new Date() }) => {
  if (!training) return { canJoin: false, reason: 'Тренировка не найдена' };
  if (training.status === 'CANCELLED') return { canJoin: false, reason: 'Тренировка отменена' };
  if (training.status === 'FINISHED') return { canJoin: false, reason: 'Тренировка завершена' };
  if (!isTrainer && !hasConfirmedBooking) return { canJoin: false, reason: 'Нет подтверждённой записи' };

  const window = getRoomWindow(training, now);
  const openAt = isTrainer ? window.trainerJoinAt : window.studentJoinAt;
  if (now < openAt) {
    return {
      canJoin: false,
      reason: isTrainer
        ? 'Комната откроется за 10 минут до начала занятия'
        : 'Вход откроется за 5 минут до начала занятия',
      openAt,
      window,
    };
  }

  return { canJoin: true, openAt, window };
};

const shouldRefundFully = (training, failedAt = new Date()) => {
  const { midpointAt } = getRoomWindow(training, failedAt);
  return failedAt < midpointAt;
};

module.exports = {
  TRAINER_JOIN_BEFORE_MIN,
  STUDENT_JOIN_BEFORE_MIN,
  START_GRACE_MIN,
  TRAINER_RECONNECT_GRACE_MIN,
  POST_TRAINING_DISCOUNT_MIN,
  POST_TRAINING_DISCOUNT_PERCENT,
  getRoomWindow,
  getJoinPolicy,
  shouldRefundFully,
};
