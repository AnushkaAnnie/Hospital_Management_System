const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { generateToken } = require('../utils/token');

// @desc    Register a new user (Patient by default, or Doctor/Admin/Receptionist if specified)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = 'Patient',
      phone,
      // Patient-specific fields
      dob,
      gender,
      bloodGroup,
      medicalNotes,
      emergencyContact,
      allergies,
      chronicConditions,
      // Doctor-specific fields (if registered by admin or setup)
      departmentId,
      specialization,
      qualification,
      experienceYears,
      consultationFee
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
        errorCode: 'USER_ALREADY_EXISTS'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User record
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      phone
    });

    let profileData = null;

    // If role is Patient, create corresponding Patient profile
    if (role === 'Patient') {
      const patient = await Patient.create({
        userId: user._id,
        dob: dob || new Date('1995-01-01'),
        gender: gender || 'Other',
        bloodGroup: bloodGroup || 'O+',
        medicalNotes: medicalNotes || '',
        emergencyContact: emergencyContact || {},
        allergies: allergies || [],
        chronicConditions: chronicConditions || []
      });
      profileData = patient;
    } else if (role === 'Doctor') {
      const doctor = await Doctor.create({
        userId: user._id,
        departmentId: departmentId || null,
        specialization: specialization || 'General Medicine',
        qualification: qualification || 'MBBS',
        experienceYears: experienceYears || 1,
        consultationFee: consultationFee || 50,
        availabilitySlots: []
      });
      profileData = doctor;
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: `${role} registered successfully`,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        profile: profileData
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Authenticate user & get JWT token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    let profile = null;
    if (user.role === 'Patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'Doctor') {
      profile = await Doctor.findOne({ userId: user._id }).populate('departmentId', 'name');
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        profile
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get currently logged in user details
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    let profile = null;
    if (req.user.role === 'Patient') {
      profile = await Patient.findOne({ userId: req.user._id });
    } else if (req.user.role === 'Doctor') {
      profile = await Doctor.findOne({ userId: req.user._id }).populate('departmentId', 'name description');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          phone: req.user.phone
        },
        profile
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe
};
