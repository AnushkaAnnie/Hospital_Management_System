const Billing = require('../models/Billing');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');

// @desc    Get billing record for an appointment (Module 10)
// @route   GET /api/billing/appointment/:appointmentId
// @access  Private
const getBillingByAppointmentId = async (req, res, next) => {
  try {
    const billing = await Billing.findOne({ appointmentId: req.params.appointmentId })
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('appointmentId');

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'No billing record found for this appointment.',
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: billing
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update billing payment status (Pay invoice)
// @route   PUT /api/billing/:id/pay
// @access  Private (Admin, Receptionist, or Patient paying their bill)
const payInvoice = async (req, res, next) => {
  try {
    const { paymentMethod, transactionId } = req.body;
    const billing = await Billing.findById(req.params.id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name _id' } });

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: `Billing invoice not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    if (billing.paymentStatus === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This invoice is already paid.',
        errorCode: 'INVOICE_ALREADY_PAID'
      });
    }

    billing.paymentStatus = 'Paid';
    billing.paymentMethod = paymentMethod || 'Online';
    billing.transactionId = transactionId || `TXN-${Date.now()}`;
    billing.paidAt = new Date();

    await billing.save();

    // Create Notification
    await Notification.create({
      userId: billing.patientId.userId._id,
      appointmentId: billing.appointmentId,
      title: 'Payment Received',
      message: `Invoice #${billing.invoiceNumber} for ₹${billing.totalAmount} has been marked as Paid.`,
      type: 'Billing'
    });

    res.status(200).json({
      success: true,
      message: 'Invoice marked as Paid successfully',
      data: billing
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all billing records
// @route   GET /api/billing
// @access  Private (Admin, Receptionist)
const getAllBillings = async (req, res, next) => {
  try {
    const { paymentStatus } = req.query;
    const filter = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const billings = await Billing.find(filter)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('appointmentId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: billings.length,
      data: billings
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get logged in patient's billing records
// @route   GET /api/billing/my
// @access  Private (Patient)
const getMyBillings = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const billings = await Billing.find({ patientId: patient._id })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('appointmentId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: billings.length,
      data: billings
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBillingByAppointmentId,
  payInvoice,
  getAllBillings,
  getMyBillings
};
