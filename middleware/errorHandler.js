// Centralized Express Error Handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error stack in development
  if (process.env.NODE_ENV === 'development') {
    console.error(' [Error Trace]:', err);
  }

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    return res.status(404).json({
      success: false,
      message,
      errorCode: 'RESOURCE_NOT_FOUND'
    });
  }

  // Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value entered for '${field}'. This value already exists.`;
    return res.status(409).json({
      success: false,
      message,
      errorCode: 'DUPLICATE_FIELD_CONFLICT'
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
      errorCode: 'VALIDATION_ERROR',
      details: messages
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token',
      errorCode: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token has expired',
      errorCode: 'TOKEN_EXPIRED'
    });
  }

  // Custom App Error (with explicit statusCode and errorCode)
  const statusCode = error.statusCode || 500;
  const errorCode = error.errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error',
    errorCode: errorCode
  });
};

module.exports = errorHandler;
