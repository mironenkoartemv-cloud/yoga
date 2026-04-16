const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/trainingController');
const { authenticate, requireRole } = require('../middleware/auth');

const trainingValidation = [
  body('title').notEmpty().withMessage('Название обязательно'),
  body('direction').isIn(['YOGA', 'PILATES']).withMessage('Направление: YOGA или PILATES'),
  body('level').isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('startAt').isISO8601().withMessage('Неверный формат даты'),
  body('durationMin').isInt({ min: 15 }).withMessage('Длительность минимум 15 минут'),
  body('maxSlots').isInt({ min: 1 }).withMessage('Минимум 1 место'),
  body('price').isInt({ min: 0 }).withMessage('Цена не может быть отрицательной'),
];

// Публичные
router.get('/', ctrl.listTrainings);
router.get('/:id', ctrl.getTraining);

// Тренер
router.get('/trainer/mine', authenticate, requireRole('TRAINER', 'ADMIN'), ctrl.myTrainings);
router.post('/', authenticate, requireRole('TRAINER', 'ADMIN'), trainingValidation, ctrl.createTraining);
router.patch('/:id', authenticate, requireRole('TRAINER', 'ADMIN'), ctrl.updateTraining);
router.delete('/:id', authenticate, requireRole('TRAINER', 'ADMIN'), ctrl.cancelTraining);

module.exports = router;
