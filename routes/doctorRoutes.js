const express = require('express');
const router = express.Router();
const {
  getAllDoctors,
  getDoctorById,
  updateAvailabilitySlots,
  getDoctorAvailableSlotsForDate
} = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorAvailableSlotsForDate);
router.put('/:id/slots', authenticate, authorize('Doctor', 'Admin'), updateAvailabilitySlots);

module.exports = router;
