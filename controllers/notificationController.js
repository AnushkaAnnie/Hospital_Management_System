const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

// @desc    Get current user's notifications (Module 9)
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark all user's notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Trigger automated reminders for upcoming appointments (Module 9)
// @route   POST /api/notifications/reminders/trigger
// @access  Private (Admin, Receptionist)
const triggerUpcomingReminders = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find booked or confirmed appointments scheduled for today or tomorrow
    const upcomingAppointments = await Appointment.find({
      appointmentDate: { $gte: today },
      status: { $in: ['Booked', 'Confirmed'] }
    }).populate({ path: 'patientId', populate: { path: 'userId', select: 'name _id' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } });

    let remindersCreated = 0;

    for (const appt of upcomingAppointments) {
      if (!appt.patientId || !appt.patientId.userId) continue;

      // Check if reminder was already sent today for this appointment
      const existingReminder = await Notification.findOne({
        userId: appt.patientId.userId._id,
        appointmentId: appt._id,
        type: 'Reminder'
      });

      if (!existingReminder) {
        await Notification.create({
          userId: appt.patientId.userId._id,
          appointmentId: appt._id,
          title: 'Upcoming Appointment Reminder',
          message: `Friendly reminder: You have an appointment with Dr. ${appt.doctorId.userId.name} scheduled on ${appt.appointmentDate} at ${appt.slotTime}.`,
          type: 'Reminder'
        });
        remindersCreated++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Appointment reminders evaluated. ${remindersCreated} new reminders generated.`,
      data: { remindersCreated }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  triggerUpcomingReminders
};
