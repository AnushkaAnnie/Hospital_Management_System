const { verifyToken } = require('../utils/token');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Authenticate JWT Token
const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
      errorCode: 'UNAUTHENTICATED'
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'The account associated with this token is invalid or inactive.',
        errorCode: 'INVALID_TOKEN'
      });
    }

    req.user = user;

    // Attach role-specific entity if applicable
    if (user.role === 'Patient') {
      req.patient = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'Doctor') {
      req.doctor = await Doctor.findOne({ userId: user._id });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is invalid or has expired.',
      errorCode: 'INVALID_TOKEN'
    });
  }
};

// Role-Based Authorization Guard
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
        errorCode: 'FORBIDDEN'
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
