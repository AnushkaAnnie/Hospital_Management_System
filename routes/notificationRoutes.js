const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  triggerUpcomingReminders
} = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getMyNotifications);
router.put('/read-all', authenticate, markAllAsRead);
router.put('/:id/read', authenticate, markAsRead);
router.post('/reminders/trigger', authenticate, authorize('Admin', 'Receptionist'), triggerUpcomingReminders);

module.exports = router;
