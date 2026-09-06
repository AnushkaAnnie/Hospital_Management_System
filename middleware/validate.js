// Request validation helper middleware
const validateRequest = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.label || field} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rule.type === 'email') {
          const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
          if (!emailRegex.test(value)) {
            errors.push(`${rule.label || field} must be a valid email address`);
          }
        }

        if (rule.type === 'date') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value) && isNaN(Date.parse(value))) {
            errors.push(`${rule.label || field} must be a valid date in YYYY-MM-DD format`);
          }
        }

        if (rule.type === 'time') {
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(value)) {
            errors.push(`${rule.label || field} must be in HH:mm 24-hour format`);
          }
        }

        if (rule.type === 'enum' && Array.isArray(rule.allowed)) {
          if (!rule.allowed.includes(value)) {
            errors.push(`${rule.label || field} must be one of: ${rule.allowed.join(', ')}`);
          }
        }

        if (rule.type === 'number') {
          if (isNaN(Number(value))) {
            errors.push(`${rule.label || field} must be a number`);
          } else {
            if (rule.min !== undefined && Number(value) < rule.min) {
              errors.push(`${rule.label || field} must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && Number(value) > rule.max) {
              errors.push(`${rule.label || field} cannot exceed ${rule.max}`);
            }
          }
        }

        if (rule.minLength && String(value).length < rule.minLength) {
          errors.push(`${rule.label || field} must be at least ${rule.minLength} characters`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Requested action violates a business rule or failed validation',
        errorCode: 'VALIDATION_ERROR',
        errors: errors
      });
    }

    next();
  };
};

module.exports = { validateRequest };
