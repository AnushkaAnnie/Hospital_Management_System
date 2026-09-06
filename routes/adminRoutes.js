const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getAppointmentReports,
  getDepartmentLoadReport,
  getDoctorUtilizationReport
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin', 'Receptionist'));

router.get('/dashboard', getDashboardSummary);
router.get('/reports/appointments', getAppointmentReports);
router.get('/reports/departments', getDepartmentLoadReport);
router.get('/reports/doctors', getDoctorUtilizationReport);

module.exports = router;
