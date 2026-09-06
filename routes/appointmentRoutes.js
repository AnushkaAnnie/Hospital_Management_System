const express = require('express');
const router = express.Router();
const {
  bookAppointment,
  updateAppointmentStatus,
  getAppointments,
  getAppointmentById
} = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

router.post(
  '/',
  authenticate,
  authorize('Patient', 'Admin', 'Receptionist'),
  validateRequest({
    doctorId: { required: true, label: 'Doctor ID' },
    appointmentDate: { required: true, type: 'date', label: 'Appointment Date' },
    slotTime: { required: true, label: 'Slot Time' }
  }),
  bookAppointment
);

router.get('/', authenticate, getAppointments);
router.get('/:id', authenticate, getAppointmentById);

router.put(
  '/:id/status',
  authenticate,
  validateRequest({
    status: { required: true, enum: ['Booked', 'Confirmed', 'Completed', 'Cancelled', 'No-show'], label: 'Status' }
  }),
  updateAppointmentStatus
);

module.exports = router;
