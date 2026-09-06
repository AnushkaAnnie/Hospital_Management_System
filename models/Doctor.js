const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required (e.g. 09:00)'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide time in HH:mm 24-hour format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required (e.g. 13:00)'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide time in HH:mm 24-hour format']
  },
  slotDurationMinutes: {
    type: Number,
    default: 30,
    min: [10, 'Slot duration must be at least 10 minutes'],
    max: [120, 'Slot duration cannot exceed 120 minutes']
  },
  maxPatientsPerSlot: {
    type: Number,
    default: 1,
    min: [1, 'At least 1 patient per slot']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor must reference a User'],
    unique: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Doctor must be assigned to a department']
  },
  specialization: {
    type: String,
    required: [true, 'Doctor specialization is required'],
    trim: true
  },
  qualification: {
    type: String,
    trim: true,
    default: 'MBBS, MD'
  },
  experienceYears: {
    type: Number,
    default: 1,
    min: 0
  },
  consultationFee: {
    type: Number,
    required: [true, 'Consultation fee is required'],
    default: 50,
    min: 0
  },
  availabilitySlots: {
    type: [availabilitySlotSchema],
    default: []
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', doctorSchema);
