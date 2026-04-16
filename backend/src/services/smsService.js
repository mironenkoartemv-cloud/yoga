/**
 * SMS Service — SMSC.ru
 *
 * Документация: https://smsc.ru/api/
 *
 * Нужные переменные в .env:
 *   SMS_LOGIN=твой_логин
 *   SMS_PASSWORD=твой_пароль
 *   SMS_SENDER=YogaApp
 */

const axios = require('axios');

const SMSC_API = 'https://smsc.ru/sys/send.php';

const STUB_MODE =
  !process.env.SMS_LOGIN ||
  process.env.SMS_LOGIN === 'STUB' ||
  process.env.NODE_ENV === 'test';

/**
 * Отправляет OTP-код на номер телефона.
 * @param {string} phone - номер в формате +79001234567
 * @param {string} code  - 6-значный код
 */
const sendOtp = async (phone, code) => {
  if (STUB_MODE) {
    console.log(`[SMS STUB] → ${phone}: Ваш код: ${code}`);
    return true;
  }

  const params = {
    login:   process.env.SMS_LOGIN,
    psw:     process.env.SMS_PASSWORD,
    phones:  phone,
    mes:     `Ваш код подтверждения YogaApp: ${code}. Не сообщайте никому.`,
    fmt:     1,        // ответ в JSON
    charset: 'utf-8',
  };

  if (process.env.SMS_SENDER) {
    params.sender = process.env.SMS_SENDER;
  }

  const { data } = await axios.get(SMSC_API, { params });

  // { "id": "...", "cnt": 1 } — успех
  // { "error": "...", "error_code": N } — ошибка
  if (data.error) {
    throw new Error(`SMSC error ${data.error_code}: ${data.error}`);
  }

  return true;
};

module.exports = { sendOtp };