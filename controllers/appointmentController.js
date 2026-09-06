const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Billing = require('../models/Billing');
const Notification = require('../models/Notification');

// @desc    Book a new appointment (Module 4: Conflict-Free Booking Engine)
// @route   POST /api/appointments
// @access  Private (Patient, Admin, Receptionist)
const bookAppointment = async (req, res, next) => {
  try {
    let {
      patientId,
      doctorId,
      departmentId,
      appointmentDate,
      slotTime,
      reason
    } = req.body;

    // If authenticated user is Patient, use their own patient profile
    if (req.user.role === 'Patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found for this account.',
          errorCode: 'PATIENT_PROFILE_NOT_FOUND'
        });
      }
      patientId = patient._id;
    } else {
      // Admin/Receptionist booking for a patient
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'patientId is required when booking as staff.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
      const existingPatient = await Patient.findById(patientId);
      if (!existingPatient) {
        return res.status(404).json({
          success: false,
          message: 'Specified patient was not found.',
          errorCode: 'RESOURCE_NOT_FOUND'
        });
      }
    }

    // Verify Doctor exists and is active
    const doctor = await Doctor.findById(doctorId).populate('userId', 'name email');
    if (!doctor || !doctor.isAvailable) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or currently unavailable for booking.',
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    departmentId = departmentId || doctor.departmentId;

    // Validate Appointment Date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (appointmentDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book appointments in the past.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Business Rule: Check for doctor conflict on this date and slot
    const conflictingDoctorAppt = await Appointment.findOne({
      doctorId,
      appointmentDate,
      slotTime,
      status: { $in: ['Booked', 'Confirmed'] }
    });

    if (conflictingDoctorAppt) {
      return res.status(409).json({
        success: false,
        message: `The selected slot (${slotTime}) on ${appointmentDate} is already booked with this doctor.`,
        errorCode: 'SLOT_ALREADY_BOOKED'
      });
    }

    // Business Rule: Check for patient conflict on this date and slot
    const conflictingPatientAppt = await Appointment.findOne({
      patientId,
      appointmentDate,
      slotTime,
      status: { $in: ['Booked', 'Confirmed'] }
    });

    if (conflictingPatientAppt) {
      return res.status(409).json({
        success: false,
        message: `Patient already has an active appointment on ${appointmentDate} at ${slotTime}.`,
        errorCode: 'PATIENT_TIME_CONFLICT'
      });
    }

    // Create Appointment
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      departmentId,
      appointmentDate,
      slotTime,
      reason: reason || 'General Consultation',
      status: 'Booked'
    });

    // Auto-create Billing record (Module 10)
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const fee = doctor.consultationFee || 50;
    const tax = Math.round(fee * 0.1 * 100) / 100;
    const totalAmount = fee + tax;

    const billing = await Billing.create({
      appointmentId: appointment._id,
      patientId,
      doctorId,
      invoiceNumber,
      amount: fee,
      tax,
      totalAmount,
      paymentStatus: 'Pending',
      paymentMethod: 'Pending'
    });

    // Auto-create Notification for Patient & Doctor (Module 9)
    const patientRecord = await Patient.findById(patientId).populate('userId', 'name');
    await Notification.create([
      {
        userId: patientRecord.userId._id,
        appointmentId: appointment._id,
        title: 'Appointment Scheduled',
        message: `Your appointment with Dr. ${doctor.userId.name} on ${appointmentDate} at ${slotTime} is booked.`,
        type: 'Booking'
      },
      {
        userId: doctor.userId._id,
        appointmentId: appointment._id,
        title: 'New Appointment Booked',
        message: `Patient ${patientRecord.userId.name} booked a slot for ${appointmentDate} at ${slotTime}.`,
        type: 'Booking'
      }
    ]);

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name email phone' } })
      .populate('departmentId', 'name');

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointment: populatedAppointment,
        billing
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update appointment status (Module 5: Workflow Engine)
// @route   PUT /api/appointments/:id/status
// @access  Private (Patient, Doctor, Admin, Receptionist)
const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, remarks, cancellationReason } = req.body;
    const appointmentId = req.params.id;

    if (!['Booked', 'Confirmed', 'Completed', 'Cancelled', 'No-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be Booked, Confirmed, Completed, Cancelled, or No-show.',
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

    // Role-based authorization & transition constraints
    const currentStatus = appointment.status;

    // Terminal states cannot be changed
    if (currentStatus === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update status of an already Completed appointment.',
        errorCode: 'INVALID_STATUS_TRANSITION'
      });
    }

    if (currentStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update status of a Cancelled appointment.',
        errorCode: 'INVALID_STATUS_TRANSITION'
      });
    }

    // Role-specific transition rules
    if (req.user.role === 'Patient') {
      // Patient can only cancel their own appointment
      if (appointment.patientId.userId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only manage your own appointments.',
          errorCode: 'FORBIDDEN'
        });
      }

      if (status !== 'Cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Patients are only permitted to cancel appointments.',
          errorCode: 'FORBIDDEN'
        });
      }
    } else if (req.user.role === 'Doctor') {
      // Doctor can only manage their own assigned appointments
      if (appointment.doctorId.userId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only update appointments assigned to you.',
          errorCode: 'FORBIDDEN'
        });
      }
    }

    // Apply status change
    appointment.status = status;
    if (remarks) appointment.remarks = remarks;

    if (status === 'Cancelled') {
      appointment.cancelledBy = req.user._id;
      appointment.cancellationReason = cancellationReason || remarks || 'Cancelled by user';
    }

    await appointment.save();

    // Create Notification
    await Notification.create({
      userId: appointment.patientId.userId._id,
      appointmentId: appointment._id,
      title: `Appointment ${status}`,
      message: `Your appointment on ${appointmentDateFormatted(appointment.appointmentDate)} has been updated to '${status}'.`,
      type: 'StatusChange'
    });

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: {
        _id: appointment._id,
        status: appointment.status,
        remarks: appointment.remarks
      }
    });
  } catch (err) {
    next(err);
  }
};

const appointmentDateFormatted = (d) => d || 'scheduled date';

// @desc    Get appointments (filtered by role and query params)
// @route   GET /api/appointments
// @access  Private
const getAppointments = async (req, res, next) => {
  try {
    const { status, date, doctorId, patientId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) filter.appointmentDate = date;

    // Enforce role isolation
    if (req.user.role === 'Patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      filter.patientId = patient._id;
    } else if (req.user.role === 'Doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      if (!doctor) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      filter.doctorId = doctor._id;
    } else {
      // Admin / Receptionist can filter arbitrarily
      if (doctorId) filter.doctorId = doctorId;
      if (patientId) filter.patientId = patientId;
    }

    const appointments = await Appointment.find(filter)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email phone' }, { path: 'departmentId', select: 'name' }] })
      .populate('departmentId', 'name')
      .sort({ appointmentDate: -1, slotTime: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single appointment by ID
// @route   GET /api/appointments/:id
// @access  Private
const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email phone' }, { path: 'departmentId', select: 'name' }] })
      .populate('departmentId', 'name');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: `Appointment not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Role check: Only the involved patient, doctor, or admin/receptionist can view
    if (req.user.role === 'Patient') {
      if (appointment.patientId.userId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden', errorCode: 'FORBIDDEN' });
      }
    } else if (req.user.role === 'Doctor') {
      if (appointment.doctorId.userId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden', errorCode: 'FORBIDDEN' });
      }
    }

    const billing = await Billing.findOne({ appointmentId: appointment._id });

    res.status(200).json({
      success: true,
      data: {
        appointment,
        billing
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  bookAppointment,
  updateAppointmentStatus,
  getAppointments,
  getAppointmentById
};
