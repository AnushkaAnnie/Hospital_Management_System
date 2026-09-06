const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

router.post(
  '/register',
  validateRequest({
    name: { required: true, minLength: 2, label: 'Name' },
    email: { required: true, type: 'email', label: 'Email' },
    password: { required: true, minLength: 6, label: 'Password' },
    phone: { required: true, label: 'Phone' }
  }),
  register
);

router.post(
  '/login',
  validateRequest({
    email: { required: true, type: 'email', label: 'Email' },
    password: { required: true, label: 'Password' }
  }),
  login
);

router.get('/me', authenticate, getMe);

module.exports = router;
