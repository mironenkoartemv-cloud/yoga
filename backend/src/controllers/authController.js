const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const smsService = require('../services/smsService');

// Хранилище OTP-кодов (в проде — Redis)
const otpStore = new Map(); // phone -> { code, expiresAt }

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register (email + password)
const registerByEmail = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, role, trainerBio } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email уже используется' });

    const hashed = await bcrypt.hash(password, 10);
    const isTrainerRequest = role === 'TRAINER';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: 'STUDENT',
      },
    });

    if (isTrainerRequest) {
      await prisma.$queryRawUnsafe(
        'UPDATE users SET "trainerRequest" = true, "trainerBio" = $1 WHERE id = \'' + user.id + '\'',
        trainerBio || null
      );
    }

    const token = generateToken(user.id);
    res.status(201).json({
      token,
      user: sanitize(user),
      trainerRequestPending: isTrainerRequest,
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login (email + password)
const loginByEmail = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ error: 'Неверные данные' });
    if (user.isBlocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

    const token = generateToken(user.id);
    res.json({ token, user: sanitize(user) });
  } catch (err) { next(err); }
};

// POST /api/auth/phone/send-otp  — отправить SMS (с проверкой существования)
const sendPhoneOtp = async (req, res, next) => {
  try {
    const { phone, purpose } = req.body; // purpose: 'login' | 'register'
    if (!phone) return res.status(400).json({ error: 'Телефон обязателен' });

    const existingUser = await prisma.user.findUnique({ where: { phone } });

    if (purpose === 'login' && !existingUser) {
      return res.status(404).json({ error: 'Пользователь с таким номером не найден. Зарегистрируйтесь' });
    }
    if (purpose === 'register' && existingUser) {
      return res.status(409).json({ error: 'Пользователь с таким номером уже существует. Войдите' });
    }
    if (existingUser?.isBlocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут
    otpStore.set(phone, { code, expiresAt });

    await smsService.sendOtp(phone, code);

    const devPayload = process.env.NODE_ENV !== 'production' ? { dev_code: code } : {};
    res.json({ message: 'SMS отправлено', ...devPayload });
  } catch (err) { next(err); }
};

// POST /api/auth/phone/verify-otp  — проверить код и создать/войти
const verifyPhoneOtp = async (req, res, next) => {
  try {
    const { phone, code, name, password, role, trainerBio } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Телефон и код обязательны' });

    const entry = otpStore.get(phone);
    if (!entry) return res.status(400).json({ error: 'Код не запрашивался или истёк' });
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: 'Код истёк, запросите новый' });
    }
    if (entry.code !== code) return res.status(400).json({ error: 'Неверный код' });

    otpStore.delete(phone);

    let user = await prisma.user.findUnique({ where: { phone } });
    const isTrainerRequest = role === 'TRAINER';
    const isNewUser = !user;

    if (!user) {
      // Регистрация — сохраняем пароль если передан
      const hashed = password ? await bcrypt.hash(password, 10) : null;
      user = await prisma.user.create({
        data: {
          phone,
          name: name || 'Пользователь',
          password: hashed,
          role: 'STUDENT', // TRAINER-запрос обрабатывается ниже
        },
      });

      if (isTrainerRequest) {
        await prisma.$queryRawUnsafe(
          'UPDATE users SET "trainerRequest" = true, "trainerBio" = $1 WHERE id = \'' + user.id + '\'',
          trainerBio || null
        );
      }
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: sanitize(user),
      trainerRequestPending: isNewUser && isTrainerRequest,
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login-by-phone  — вход по телефону + пароль
const loginByPhonePassword = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Телефон и пароль обязательны' });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.password) return res.status(401).json({ error: 'Неверные данные' });
    if (user.isBlocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

    const token = generateToken(user.id);
    res.json({ token, user: sanitize(user) });
  } catch (err) { next(err); }
};

// POST /api/auth/telegram  — Telegram Login (заглушка)
const telegramLogin = async (req, res, next) => {
  try {
    const { id, first_name, last_name, username, photo_url, hash } = req.body;

    // STUB: пропускаем верификацию hash
    // TODO: проверить hash через HMAC-SHA256 с BOT_TOKEN

    let user = await prisma.user.findFirst({
      where: { email: `tg_${id}@stub.local` },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `tg_${id}@stub.local`,
          name: [first_name, last_name].filter(Boolean).join(' ') || username || 'TG User',
          avatarUrl: photo_url || null,
          role: 'STUDENT',
        },
      });
    }

    const token = generateToken(user.id);
    res.json({ token, user: sanitize(user) });
  } catch (err) { next(err); }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: sanitize(req.user) });
};

const sanitize = (user) => {
  const { password, ...safe } = user;
  return safe;
};

module.exports = {
  registerByEmail,
  loginByEmail,
  sendPhoneOtp,
  verifyPhoneOtp,
  telegramLogin,
  getMe,
  loginByPhonePassword,
};