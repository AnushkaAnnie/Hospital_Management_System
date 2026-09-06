const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');

// @desc    Issue digital prescription for an appointment (Module 6)
// @route   POST /api/prescriptions
// @access  Private (Doctor, Admin)
const issuePrescription = async (req, res, next) => {
  try {
    const {
      appointmentId,
      diagnosis,
      medicines,
      notes,
      followUpDate
    } = req.body;

    if (!appointmentId || !diagnosis || !medicines || !medicines.length) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId, diagnosis, and at least one medicine entry are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name _id' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name _id' } });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: `Appointment not found with id ${appointmentId}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Role check: Only the doctor assigned to this appointment or an Admin can issue
    if (
      req.user.role === 'Doctor' &&
      appointment.doctorId.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only issue prescriptions for appointments assigned to you.',
        errorCode: 'FORBIDDEN'
      });
    }

    // Check if appointment is cancelled
    if (appointment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot issue a prescription for a Cancelled appointment.',
        errorCode: 'INVALID_APPOINTMENT_STATE'
      });
    }

    // Check if prescription already exists for this appointment
    const existingPrescription = await Prescription.findOne({ appointmentId });
    if (existingPrescription) {
      return res.status(409).json({
        success: false,
        message: 'A prescription has already been issued for this appointment.',
        errorCode: 'PRESCRIPTION_ALREADY_EXISTS'
      });
    }

    // Create Prescription
    const prescription = await Prescription.create({
      appointmentId,
      patientId: appointment.patientId._id,
      doctorId: appointment.doctorId._id,
      diagnosis,
      medicines,
      notes: notes || '',
      followUpDate: followUpDate || null,
      issuedAt: new Date()
    });

    // Mark appointment as Completed in the workflow
    appointment.status = 'Completed';
    appointment.remarks = notes ? `Prescription issued. Notes: ${notes}` : 'Prescription issued. Visit completed.';
    await appointment.save();

    // Create Notification for Patient
    await Notification.create({
      userId: appointment.patientId.userId._id,
      appointmentId: appointment._id,
      title: 'Digital Prescription Available',
      message: `Dr. ${appointment.doctorId.userId.name} has issued your prescription. Diagnosis: ${diagnosis}`,
      type: 'Prescription'
    });

    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email' }, { path: 'departmentId', select: 'name' }] });

    res.status(201).json({
      success: true,
      message: 'Prescription issued successfully and appointment marked as Completed',
      data: populatedPrescription
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get prescription by appointment ID
// @route   GET /api/prescriptions/appointment/:appointmentId
// @access  Private
const getPrescriptionByAppointmentId = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({ appointmentId: req.params.appointmentId })
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email phone' }, { path: 'departmentId', select: 'name' }] })
      .populate('appointmentId');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'No prescription found for this appointment.',
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Role check
    if (req.user.role === 'Patient' && prescription.patientId.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden', errorCode: 'FORBIDDEN' });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Private
const getPrescriptionById = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email phone' }, { path: 'departmentId', select: 'name' }] });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: `Prescription not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  issuePrescription,
  getPrescriptionByAppointmentId,
  getPrescriptionById
};
