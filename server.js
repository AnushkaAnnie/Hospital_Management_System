const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB().then(async () => {
  try {
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server Startup]: Initializing default demonstration records...');
      const seedData = require('./utils/seeder');
      await seedData(false);
      console.log('[Server Startup]: Demonstration data ready for immediate evaluation.');
    }
  } catch (err) {
    console.warn('[Server Startup]: Auto-seed notice:', err.message);
  }
});

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// HTTP Request Logger in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve Static Frontend Assets (Demo UI)
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hospital Patient & Appointment Management System API is healthy and operational.',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount Resource Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/billing', require('./routes/billingRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// 404 Route Catch-All (for undefined API endpoints)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' does not exist on this server.`,
    errorCode: 'ENDPOINT_NOT_FOUND'
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Hospital Management Server]: Running on http://localhost:${PORT}`);
  });
}

module.exports = app;
