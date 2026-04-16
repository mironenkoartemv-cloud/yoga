/**
 * Push Notification Service — заглушка
 *
 * Для боевого режима подключить Firebase Admin SDK:
 *   npm install firebase-admin
 *
 * Документация:
 *   https://firebase.google.com/docs/admin/setup
 *
 * Нужные переменные в .env:
 *   FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
 *
 * Как получить:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

const STUB_MODE = !process.env.FIREBASE_SERVICE_ACCOUNT ||
  process.env.FIREBASE_SERVICE_ACCOUNT === '{}';

// В реальной реализации хранить FCM токены пользователей
// (добавить поле fcmToken в модель User и обновлять при логине с устройства)

let firebaseApp;

const initFirebase = () => {
  if (STUB_MODE || firebaseApp) return;

  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('[Push] Firebase initialized');
  } catch (err) {
    console.error('[Push] Firebase init error:', err.message);
  }
};

initFirebase();

const sendPush = async (userId, title, body) => {
  if (STUB_MODE) {
    console.log(`[PUSH STUB] → userId:${userId} | ${title}: ${body}`);
    return;
  }

  // TODO: получить FCM token пользователя
  // const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
  // if (!user?.fcmToken) return;

  // const admin = require('firebase-admin');
  // await admin.messaging().send({
  //   token: user.fcmToken,
  //   notification: { title, body },
  //   android: { priority: 'high' },
  //   apns: { payload: { aps: { sound: 'default' } } },
  // });
};

const sendPushToMany = async (userIds, title, body) => {
  await Promise.allSettled(userIds.map((id) => sendPush(id, title, body)));
};

module.exports = { sendPush, sendPushToMany };
