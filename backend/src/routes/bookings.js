const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.post('/', ctrl.createBooking);
router.delete('/:id', ctrl.cancelBooking);
router.get('/my', ctrl.myBookings);
router.get('/training/:trainingId', requireRole('TRAINER', 'ADMIN'), ctrl.trainingParticipants);

module.exports = router;
