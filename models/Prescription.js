const mongoose = require('mongoose');

const medicineItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required (e.g., 500mg, 10ml)'],
    trim: true
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required (e.g., Once daily, 1-0-1)'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required (e.g., 5 days, 2 weeks)'],
    trim: true
  },
  instructions: {
    type: String,
    trim: true,
    default: 'Take after meals'
  }
}, { _id: true });

const prescriptionSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Prescription must be linked to an Appointment'],
    unique: true,
    index: true
  },
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
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true
  },
  medicines: {
    type: [medicineItemSchema],
    validate: [
      val => val.length > 0,
      'Prescription must contain at least one medicine'
    ]
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  followUpDate: {
    type: Date,
    default: null
  },
  issuedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
