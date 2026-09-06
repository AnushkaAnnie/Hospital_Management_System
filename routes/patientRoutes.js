const express = require('express');
const router = express.Router();
const {
  getPatientHistory,
  getAllPatients,
  getPatientById,
  updatePatientProfile
} = require('../controllers/patientController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('Doctor', 'Admin', 'Receptionist'), getAllPatients);
router.get('/:id', authenticate, getPatientById);
router.get('/:id/history', authenticate, getPatientHistory);
router.put('/:id', authenticate, updatePatientProfile);

module.exports = router;
