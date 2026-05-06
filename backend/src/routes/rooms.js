const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { getJoinPolicy, getRoomWindow } = require('../services/roomPolicy');

const LIVEKIT_DEV_URL = 'ws://localhost:7880';
const LIVEKIT_DEV_API_KEY = 'devkey';
const LIVEKIT_DEV_API_SECRET = 'secret';

const getLiveKitConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const livekitUrl = process.env.LIVEKIT_URL || (!isProduction ? LIVEKIT_DEV_URL : null);
  const apiKey = process.env.LIVEKIT_API_KEY || (!isProduction ? LIVEKIT_DEV_API_KEY : null);
  const apiSecret = process.env.LIVEKIT_API_SECRET || (!isProduction ? LIVEKIT_DEV_API_SECRET : null);

  if (!livekitUrl || !apiKey || !apiSecret) {
    throw new Error('LiveKit is not configured');
  }

  return { livekitUrl, apiKey, apiSecret };
};

const getTrainingAccess = async (trainingId, user) => {
  const training = await prisma.training.findUniqueOrThrow({
    where: { id: trainingId },
    include: { trainer: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const isTrainer = training.trainerId === user.id;
  const booking = !isTrainer
    ? await prisma.booking.findFirst({
        where: { userId: user.id, trainingId, status: 'CONFIRMED' },
      })
    : null;

  const policy = getJoinPolicy({
    training,
    isTrainer,
    hasConfirmedBooking: Boolean(booking),
  });

  return { training, isTrainer, policy };
};

// GET /api/rooms/:trainingId — проверить доступ и получить состояние комнаты
router.get('/:trainingId', authenticate, async (req, res, next) => {
  try {
    const { trainingId } = req.params;

    const { training, isTrainer, policy } = await getTrainingAccess(trainingId, req.user);

    const room = await prisma.room.findUnique({
      where: { trainingId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        },
      },
    });

    res.json({
      training,
      room,
      isTrainer,
      canJoin: policy.canJoin,
      reason: policy.reason,
      openAt: policy.openAt,
      window: getRoomWindow(training),
    });
  } catch (err) { next(err); }
});

// POST /api/rooms/:trainingId/livekit-token — выдать токен для параллельной LiveKit-комнаты
router.post('/:trainingId/livekit-token', authenticate, async (req, res, next) => {
  try {
    const { trainingId } = req.params;
    const { training, isTrainer, policy } = await getTrainingAccess(trainingId, req.user);
    if (!policy.canJoin) return res.status(403).json({ error: policy.reason });

    const { AccessToken } = await import('livekit-server-sdk');
    const { livekitUrl, apiKey, apiSecret } = getLiveKitConfig();
    const roomName = `training-${trainingId}`;
    const participantName = req.user.name || req.user.email || req.user.phone || 'Участник';

    const token = new AccessToken(apiKey, apiSecret, {
      identity: req.user.id,
      name: participantName,
      metadata: JSON.stringify({
        role: isTrainer ? 'TRAINER' : 'STUDENT',
        trainingId,
      }),
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isTrainer,
    });

    res.json({
      token: await token.toJwt(),
      livekitUrl,
      roomName,
      isTrainer,
      training: {
        id: training.id,
        title: training.title,
        status: training.status,
        trainer: training.trainer,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
