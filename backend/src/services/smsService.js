/**
 * SMS Service
 *
 * Providers:
 *   - stub: prints OTP to backend logs
 *   - exolve: sends SMS via MTS Exolve SendSMS API
 *   - smsc: legacy SMSC.ru integration
 */

const axios = require('axios');

const EXOLVE_SEND_SMS_URL = 'https://api.exolve.ru/messaging/v1/SendSMS';
const SMSC_API = 'https://smsc.ru/sys/send.php';

const getProvider = () => (process.env.SMS_PROVIDER || 'stub').toLowerCase();

const normalizePhoneForExolve = (phone) => String(phone || '').replace(/\D/g, '');

const normalizeSenderForExolve = (sender) => {
  const value = String(sender || '').trim();
  const looksLikePhone = /^\+?[\d\s()-]+$/.test(value);
  return looksLikePhone ? normalizePhoneForExolve(value) : value;
};

const buildOtpText = (code) =>
  `Ваш код подтверждения YogaApp: ${code}. Не сообщайте никому.`;

const sendViaExolve = async (phone, code) => {
  const apiKey = process.env.EXOLVE_API_KEY || process.env.SMS_API_KEY;
  const sender = process.env.EXOLVE_SMS_SENDER || process.env.SMS_SENDER;

  if (!apiKey || apiKey === 'STUB') {
    throw new Error('EXOLVE_API_KEY не настроен');
  }

  if (!sender || sender === 'STUB') {
    throw new Error('EXOLVE_SMS_SENDER не настроен');
  }

  const payload = {
    number: normalizeSenderForExolve(sender),
    destination: normalizePhoneForExolve(phone),
    text: buildOtpText(code),
  };

  try {
    const { data } = await axios.post(EXOLVE_SEND_SMS_URL, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return data;
  } catch (err) {
    const status = err.response?.status;
    const details = err.response?.data;
    const message = typeof details === 'string' ? details : JSON.stringify(details || {});
    throw new Error(`Exolve SMS error${status ? ` ${status}` : ''}: ${message || err.message}`);
  }
};

const sendViaSmsc = async (phone, code) => {
  const params = {
    login: process.env.SMS_LOGIN,
    psw: process.env.SMS_PASSWORD,
    phones: phone,
    mes: buildOtpText(code),
    fmt: 1,
    charset: 'utf-8',
  };

  if (process.env.SMS_SENDER) {
    params.sender = process.env.SMS_SENDER;
  }

  const { data } = await axios.get(SMSC_API, { params });

  if (data.error) {
    throw new Error(`SMSC error ${data.error_code}: ${data.error}`);
  }

  return data;
};

/**
 * Отправляет OTP-код на номер телефона.
 * @param {string} phone - номер в формате +79001234567
 * @param {string} code  - 6-значный код
 */
const sendOtp = async (phone, code) => {
  const provider = getProvider();

  if (provider === 'stub' || process.env.NODE_ENV === 'test') {
    console.log(`[SMS STUB] -> ${phone}: Ваш код: ${code}`);
    return { stub: true };
  }

  if (provider === 'exolve') {
    return sendViaExolve(phone, code);
  }

  if (provider === 'smsc') {
    return sendViaSmsc(phone, code);
  }

  throw new Error(`Неизвестный SMS_PROVIDER: ${provider}`);
};

module.exports = { sendOtp };
