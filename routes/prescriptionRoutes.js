const express = require('express');
const router = express.Router();
const {
  issuePrescription,
  getPrescriptionByAppointmentId,
  getPrescriptionById
} = require('../controllers/prescriptionController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

router.post(
  '/',
  authenticate,
  authorize('Doctor', 'Admin'),
  validateRequest({
    appointmentId: { required: true, label: 'Appointment ID' },
    diagnosis: { required: true, label: 'Diagnosis' }
  }),
  issuePrescription
);

router.get('/appointment/:appointmentId', authenticate, getPrescriptionByAppointmentId);
router.get('/:id', authenticate, getPrescriptionById);

module.exports = router;
