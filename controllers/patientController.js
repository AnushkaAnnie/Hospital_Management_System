const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Billing = require('../models/Billing');

// @desc    Get patient medical visit & prescription history (Module 7)
// @route   GET /api/patients/:id/history
// @access  Private (Patient self, Treating Doctors, Admin, Receptionist)
const getPatientHistory = async (req, res, next) => {
  try {
    const patientId = req.params.id;
    const patient = await Patient.findById(patientId).populate('userId', 'name email phone');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Patient not found with id ${patientId}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Role check: If Patient, can only view their own history
    if (
      req.user.role === 'Patient' &&
      patient.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only view your own medical history.',
        errorCode: 'FORBIDDEN'
      });
    }

    // Fetch chronological appointments
    const appointments = await Appointment.find({ patientId: patient._id })
      .populate({ path: 'doctorId', populate: [{ path: 'userId', select: 'name email' }, { path: 'departmentId', select: 'name' }] })
      .populate('departmentId', 'name')
      .sort({ appointmentDate: -1, slotTime: -1 });

    // Fetch all prescriptions
    const prescriptions = await Prescription.find({ patientId: patient._id })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .sort({ issuedAt: -1 });

    // Fetch billing history
    const billings = await Billing.find({ patientId: patient._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        patient: {
          _id: patient._id,
          name: patient.userId.name,
          email: patient.userId.email,
          phone: patient.userId.phone,
          dob: patient.dob,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          allergies: patient.allergies,
          chronicConditions: patient.chronicConditions,
          emergencyContact: patient.emergencyContact,
          medicalNotes: patient.medicalNotes
        },
        summary: {
          totalVisits: appointments.length,
          completedVisits: appointments.filter(a => a.status === 'Completed').length,
          activePrescriptions: prescriptions.length,
          pendingBillsCount: billings.filter(b => b.paymentStatus === 'Pending').length
        },
        appointments,
        prescriptions,
        billings
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private (Doctor, Admin, Receptionist)
const getAllPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find()
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private
const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('userId', 'name email phone');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Patient not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update patient profile
// @route   PUT /api/patients/:id
// @access  Private
const updatePatientProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Patient not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    if (req.user.role === 'Patient' && patient.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden', errorCode: 'FORBIDDEN' });
    }

    const { dob, gender, bloodGroup, medicalNotes, emergencyContact, allergies, chronicConditions } = req.body;
    if (dob) patient.dob = dob;
    if (gender) patient.gender = gender;
    if (bloodGroup) patient.bloodGroup = bloodGroup;
    if (medicalNotes !== undefined) patient.medicalNotes = medicalNotes;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (allergies) patient.allergies = allergies;
    if (chronicConditions) patient.chronicConditions = chronicConditions;

    await patient.save();

    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: patient
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPatientHistory,
  getAllPatients,
  getPatientById,
  updatePatientProfile
};
