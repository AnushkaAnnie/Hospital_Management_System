const Department = require('../models/Department');
const Doctor = require('../models/Doctor');

// @desc    Get all departments (Directory)
// @route   GET /api/departments
// @access  Public
const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate({
        path: 'headDoctorId',
        populate: { path: 'userId', select: 'name email phone' }
      })
      .sort({ name: 1 });

    // Attach doctor count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const doctorCount = await Doctor.countDocuments({ departmentId: dept._id });
        return {
          ...dept.toObject(),
          doctorCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: departmentsWithCounts.length,
      data: departmentsWithCounts
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single department with associated doctors
// @route   GET /api/departments/:id
// @access  Public
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate({
        path: 'headDoctorId',
        populate: { path: 'userId', select: 'name email phone' }
      });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: `Department not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    const doctors = await Doctor.find({ departmentId: department._id })
      .populate('userId', 'name email phone');

    res.status(200).json({
      success: true,
      data: {
        department,
        doctors
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private (Admin only)
const createDepartment = async (req, res, next) => {
  try {
    const { name, description, headDoctorId } = req.body;

    const existing = await Department.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A department named '${name}' already exists.`,
        errorCode: 'DUPLICATE_FIELD_CONFLICT'
      });
    }

    const department = await Department.create({
      name,
      description,
      headDoctorId: headDoctorId || null
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private (Admin only)
const updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: `Department not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete department (soft delete / toggle active)
// @route   DELETE /api/departments/:id
// @access  Private (Admin only)
const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: `Department not found with id ${req.params.id}`,
        errorCode: 'RESOURCE_NOT_FOUND'
      });
    }

    department.isActive = false;
    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department deactivated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get list of unique specializations
// @route   GET /api/departments/specializations
// @access  Public
const getAllSpecializations = async (req, res, next) => {
  try {
    const specializations = await Doctor.distinct('specialization');
    res.status(200).json({
      success: true,
      count: specializations.length,
      data: specializations
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAllSpecializations
};
