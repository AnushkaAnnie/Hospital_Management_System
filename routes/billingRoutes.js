const express = require('express');
const router = express.Router();
const {
  getBillingByAppointmentId,
  payInvoice,
  getAllBillings,
  getMyBillings
} = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('Admin', 'Receptionist'), getAllBillings);
router.get('/my', authenticate, authorize('Patient'), getMyBillings);
router.get('/appointment/:appointmentId', authenticate, getBillingByAppointmentId);
router.put('/:id/pay', authenticate, payInvoice);

module.exports = router;
