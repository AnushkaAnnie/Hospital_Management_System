const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required'],
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor reference is required'],
    index: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department reference is required']
  },
  appointmentDate: {
    type: String, // Stored as YYYY-MM-DD for deterministic day matching
    required: [true, 'Appointment date is required (YYYY-MM-DD)'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD']
  },
  slotTime: {
    type: String, // e.g., "09:00 - 09:30"
    required: [true, 'Slot time is required (e.g. 09:00 - 09:30)']
  },
  status: {
    type: String,
    enum: ['Booked', 'Confirmed', 'Completed', 'Cancelled', 'No-show'],
    default: 'Booked',
    index: true
  },
  reason: {
    type: String,
    trim: true,
    default: 'General Consultation'
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Composite index to speed up conflict-detection queries
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, slotTime: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
