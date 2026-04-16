/**
 * SMS Service — заглушка
 *
 * Для боевого режима раскомментировать нужный провайдер.
 *
 * Рекомендуемые провайдеры для РФ:
 *   - SMSC.ru         https://smsc.ru/api/
 *   - МТС Exolve      https://exolve.ru/docs/
 *   - СМС-Центр       https://smsc.ru
 *
 * Нужные переменные в .env:
 *   SMS_PROVIDER=smsc
 *   SMS_API_KEY=...
 *   SMS_SENDER=YogaApp
 */

const sendOtp = async (phone, code) => {
  console.log(`[SMS STUB] → ${phone}: Ваш код: ${code}`);

  // --- SMSC.ru пример ---
  // const axios = require('axios');
  // await axios.get('https://smsc.ru/sys/send.php', {
  //   params: {
  //     login: process.env.SMS_LOGIN,
  //     psw: process.env.SMS_PASSWORD,
  //     phones: phone,
  //     mes: `Ваш код: ${code}`,
  //     sender: process.env.SMS_SENDER,
  //   },
  // });

  return true;
};

module.exports = { sendOtp };
