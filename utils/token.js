const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET || 'hospital_mgmt_super_secret_jwt_key_2026_lnt_secure',
    {
      expiresIn: process.env.JWT_EXPIRE || '24h'
    }
  );
};

const verifyToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET || 'hospital_mgmt_super_secret_jwt_key_2026_lnt_secure'
  );
};

module.exports = { generateToken, verifyToken };
