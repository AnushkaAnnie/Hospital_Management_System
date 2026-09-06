const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Department = require('../models/Department');
const Billing = require('../models/Billing');
const User = require('../models/User');

// @desc    Get Admin Overview Dashboard Metrics
// @route   GET /api/admin/dashboard
// @access  Private (Admin, Receptionist)
const getDashboardSummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalPatients,
      totalDoctors,
      totalDepartments,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      cancelledAppointments,
      totalBilling
    ] = await Promise.all([
      Patient.countDocuments(),
      Doctor.countDocuments({ isAvailable: true }),
      Department.countDocuments({ isActive: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ appointmentDate: today }),
      Appointment.countDocuments({ status: 'Booked' }),
      Appointment.countDocuments({ status: 'Completed' }),
      Appointment.countDocuments({ status: 'Cancelled' }),
      Billing.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0]
              }
            },
            pendingRevenue: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'Pending'] }, '$totalAmount', 0]
              }
            }
          }
        }
      ])
    ]);

    const revenue = totalBilling[0] || { totalRevenue: 0, pendingRevenue: 0 };

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        totalDoctors,
        totalDepartments,
        totalAppointments,
        todayAppointments,
        statusBreakdown: {
          booked: pendingAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments
        },
        financials: {
          collectedRevenue: revenue.totalRevenue,
          pendingRevenue: revenue.pendingRevenue
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Daily & weekly appointment reports (Module 12)
// @route   GET /api/admin/reports/appointments
// @access  Private (Admin, Receptionist)
const getAppointmentReports = async (req, res, next) => {
  try {
    // Group appointments by date
    const dailyStats = await Appointment.aggregate([
      {
        $group: {
          _id: '$appointmentDate',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
          },
          booked: {
            $sum: { $cond: [{ $eq: ['$status', 'Booked'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 14 }
    ]);

    // Group appointments by status
    const statusDistribution = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyReports: dailyStats,
        statusDistribution
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Department Load Report (Module 12)
// @route   GET /api/admin/reports/departments
// @access  Private (Admin, Receptionist)
const getDepartmentLoadReport = async (req, res, next) => {
  try {
    const departments = await Department.find({ isActive: true });

    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        const appointmentCount = await Appointment.countDocuments({ departmentId: dept._id });
        const doctorCount = await Doctor.countDocuments({ departmentId: dept._id });
        const completedCount = await Appointment.countDocuments({
          departmentId: dept._id,
          status: 'Completed'
        });

        return {
          departmentId: dept._id,
          name: dept.name,
          doctorCount,
          totalAppointments: appointmentCount,
          completedAppointments: completedCount,
          completionRate: appointmentCount > 0 ? Math.round((completedCount / appointmentCount) * 100) : 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: departmentStats
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Doctor Utilization Report (Module 12)
// @route   GET /api/admin/reports/doctors
// @access  Private (Admin, Receptionist)
const getDoctorUtilizationReport = async (req, res, next) => {
  try {
    const doctors = await Doctor.find()
      .populate('userId', 'name email')
      .populate('departmentId', 'name');

    const doctorStats = await Promise.all(
      doctors.map(async (doc) => {
        const totalAppointments = await Appointment.countDocuments({ doctorId: doc._id });
        const completedAppointments = await Appointment.countDocuments({
          doctorId: doc._id,
          status: 'Completed'
        });

        // Calculate total revenue generated by this doctor
        const billings = await Billing.find({ doctorId: doc._id, paymentStatus: 'Paid' });
        const revenueGenerated = billings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        return {
          doctorId: doc._id,
          doctorName: doc.userId ? doc.userId.name : 'Unknown',
          department: doc.departmentId ? doc.departmentId.name : 'Unassigned',
          specialization: doc.specialization,
          consultationFee: doc.consultationFee,
          activeSlotsCount: doc.availabilitySlots.length,
          totalAppointments,
          completedAppointments,
          revenueGenerated
        };
      })
    );

    res.status(200).json({
      success: true,
      data: doctorStats
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardSummary,
  getAppointmentReports,
  getDepartmentLoadReport,
  getDoctorUtilizationReport
};
