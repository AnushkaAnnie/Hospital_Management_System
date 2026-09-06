const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');

// Helper to generate time slot intervals (e.g., "09:00 - 09:30")
const generateTimeSlots = (startTime, endTime, durationMinutes) => {
  const slots = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  while (currentMinutes + durationMinutes <= endTotalMinutes) {
    const sHour = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
    const sMin = String(currentMinutes % 60).padStart(2, '0');
    const nextMinutes = currentMinutes + durationMinutes;
    const eHour = String(Math.floor(nextMinutes / 60)).padStart(2, '0');
    const eMin = String(nextMinutes % 60).padStart(2, '0');

    slots.push(`${sHour}:${sMin} - ${eHour}:${eMin}`);
    currentMinutes = nextMinutes;
  }

  return slots;
};

// @desc    Get / Filter doctors by department, specialization, name (Module 11)
// @route   GET /api/doctors
// @access  Public
const getAllDoctors = async (req, res, next) => {
  try {
    const { department, specialization, search, available } = req.query;
    const query = { isAvailable: true };

    if (department) {
      query.departmentId = department;
    }

    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }

    if (available !== undefined) {
      query.isAvailable = available === 'true';
    }

    let doctors = await Doctor.find(query)
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name description');

    // Filter by doctor name if search param provided
    if (search) {
      const searchLower = search.toLowerCase();
      doctors = doctors.filter(doc => 
        doc.userId && doc.userId.name.toLowerCase().includes(searchLower)
      );
    }

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single doctor profile
// @route   GET /api/doctors/:id
// @access  Public
const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name description');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `Doctor not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update doctor availability slots (Module 3)
// @route   PUT /api/doctors/:id/slots
// @access  Private (Doctor owner or Admin)
const updateAvailabilitySlots = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `Doctor not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Role check: Only the doctor themselves or Admin can update slots
    if (
      req.user.role !== 'Admin' &&
      req.user._id.toString() !== doctor.userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only manage your own availability slots.',
        errorCode: 'FORBIDDEN'
      });
    }

    const { availabilitySlots } = req.body;

    if (!Array.isArray(availabilitySlots)) {
      return res.status(400).json({
        success: false,
        message: 'availabilitySlots must be an array of schedule slots',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Validate each slot
    for (const slot of availabilitySlots) {
      if (!slot.dayOfWeek || !slot.startTime || !slot.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Each slot must contain dayOfWeek, startTime, and endTime',
          errorCode: 'VALIDATION_ERROR'
        });
      }
      if (slot.startTime >= slot.endTime) {
        return res.status(400).json({
          success: false,
          message: `Start time (${slot.startTime}) must be earlier than end time (${slot.endTime})`,
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    doctor.availabilitySlots = availabilitySlots;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: 'Doctor availability slots updated successfully',
      data: {
        _id: doctor._id,
        availabilitySlots: doctor.availabilitySlots
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get available booking slots for doctor on a specific date
// @route   GET /api/doctors/:id/slots
// @access  Public
const getDoctorAvailableSlotsForDate = async (req, res, next) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter date (YYYY-MM-DD) is required',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `Doctor not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    // Determine day of the week for given date
    const parsedDate = new Date(date + 'T00:00:00Z');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[parsedDate.getUTCDay()];

    // Find configured slots for that day
    const dayConfigs = doctor.availabilitySlots.filter(
      s => s.dayOfWeek === dayOfWeek && s.isActive
    );

    let allGeneratedSlots = [];
    dayConfigs.forEach(config => {
      const slots = generateTimeSlots(config.startTime, config.endTime, config.slotDurationMinutes || 30);
      allGeneratedSlots = allGeneratedSlots.concat(slots);
    });

    // Remove duplicates
    allGeneratedSlots = [...new Set(allGeneratedSlots)];

    // Fetch existing non-cancelled appointments for this doctor on this date
    const bookedAppointments = await Appointment.find({
      doctorId: doctor._id,
      appointmentDate: date,
      status: { $in: ['Booked', 'Confirmed'] }
    }).select('slotTime');

    const bookedSlotTimes = new Set(bookedAppointments.map(a => a.slotTime));

    // Construct slot list with booking availability flag
    const slotsWithAvailability = allGeneratedSlots.map(slot => ({
      slotTime: slot,
      isAvailable: !bookedSlotTimes.has(slot)
    }));

    res.status(200).json({
      success: true,
      data: {
        doctorId: doctor._id,
        date,
        dayOfWeek,
        slots: slotsWithAvailability
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  updateAvailabilitySlots,
  getDoctorAvailableSlotsForDate
};
