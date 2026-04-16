const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register',
  [
    body('email').isEmail().withMessage('Неверный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль минимум 6 символов'),
    body('name').notEmpty().withMessage('Имя обязательно'),
  ],
  ctrl.registerByEmail
);

router.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  ctrl.loginByEmail
);

router.post('/phone/send-otp', ctrl.sendPhoneOtp);
router.post('/phone/verify-otp', ctrl.verifyPhoneOtp);
router.post('/telegram', ctrl.telegramLogin);

router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
