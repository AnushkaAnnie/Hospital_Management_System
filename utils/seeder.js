const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { connectDB, disconnectDB } = require('../config/db');

dotenv.config();

const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Billing = require('../models/Billing');
const Notification = require('../models/Notification');

const seedData = async (shouldExit = true) => {
  try {
    await connectDB();
    console.log('[Seeder]: Purging existing database records...');

    await Promise.all([
      User.deleteMany(),
      Patient.deleteMany(),
      Doctor.deleteMany(),
      Department.deleteMany(),
      Appointment.deleteMany(),
      Prescription.deleteMany(),
      Billing.deleteMany(),
      Notification.deleteMany()
    ]);

    const defaultPassword = await bcrypt.hash('password123', 10);

    console.log('[Seeder]: Creating Departments...');
    const cardiology = await Department.create({
      name: 'Cardiology',
      description: 'Diagnosis and treatment of congenital heart defects, coronary artery disease, heart failure, and valvular heart disease.'
    });

    const neurology = await Department.create({
      name: 'Neurology',
      description: 'Specialized care for disorders of the nervous system, brain, spine, nerves, and muscles.'
    });

    const orthopedics = await Department.create({
      name: 'Orthopedics',
      description: 'Prevention, diagnosis, and treatment of disorders of the bones, joints, ligaments, tendons, and muscles.'
    });

    const pediatrics = await Department.create({
      name: 'Pediatrics',
      description: 'Comprehensive medical care for infants, children, and adolescents.'
    });

    console.log('[Seeder]: Creating Staff and Users...');
    // Admin & Receptionist
    const adminUser = await User.create({
      name: 'Dr. Evelyn Vance (Chief Admin)',
      email: 'admin@hospital.com',
      passwordHash: defaultPassword,
      role: 'Admin',
      phone: '+1-555-0100'
    });

    const receptionistUser = await User.create({
      name: 'Clara Oswald (Front Desk)',
      email: 'receptionist@hospital.com',
      passwordHash: defaultPassword,
      role: 'Receptionist',
      phone: '+1-555-0101'
    });

    // Doctor Users
    const doc1User = await User.create({
      name: 'Dr. Rajesh Sharma',
      email: 'dr.sharma@hospital.com',
      passwordHash: defaultPassword,
      role: 'Doctor',
      phone: '+1-555-0111'
    });

    const doc2User = await User.create({
      name: 'Dr. Ananya Patel',
      email: 'dr.patel@hospital.com',
      passwordHash: defaultPassword,
      role: 'Doctor',
      phone: '+1-555-0112'
    });

    const doc3User = await User.create({
      name: 'Dr. Michael Chen',
      email: 'dr.chen@hospital.com',
      passwordHash: defaultPassword,
      role: 'Doctor',
      phone: '+1-555-0113'
    });

    // Doctor Availability Slots Definition
    const commonSlots = [
      { dayOfWeek: 'Monday', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Monday', startTime: '14:00', endTime: '17:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Friday', startTime: '09:00', endTime: '13:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 },
      { dayOfWeek: 'Saturday', startTime: '10:00', endTime: '14:00', slotDurationMinutes: 30, maxPatientsPerSlot: 1 }
    ];

    const doctor1 = await Doctor.create({
      userId: doc1User._id,
      departmentId: cardiology._id,
      specialization: 'Interventional Cardiology',
      qualification: 'MBBS, MD (Cardiology), FACC',
      experienceYears: 14,
      consultationFee: 120,
      availabilitySlots: commonSlots
    });

    const doctor2 = await Doctor.create({
      userId: doc2User._id,
      departmentId: neurology._id,
      specialization: 'Clinical Neurophysiology',
      qualification: 'MBBS, DM (Neurology)',
      experienceYears: 9,
      consultationFee: 110,
      availabilitySlots: commonSlots
    });

    const doctor3 = await Doctor.create({
      userId: doc3User._id,
      departmentId: orthopedics._id,
      specialization: 'Joint Replacement & Sports Medicine',
      qualification: 'MBBS, MS (Ortho), MCh',
      experienceYears: 12,
      consultationFee: 100,
      availabilitySlots: commonSlots
    });

    // Set Head of Department
    cardiology.headDoctorId = doctor1._id;
    await cardiology.save();
    neurology.headDoctorId = doctor2._id;
    await neurology.save();

    console.log('[Seeder]: Creating Patients...');
    // Patient 1
    const pat1User = await User.create({
      name: 'John Doe',
      email: 'john.doe@patient.com',
      passwordHash: defaultPassword,
      role: 'Patient',
      phone: '+1-555-0201'
    });

    const patient1 = await Patient.create({
      userId: pat1User._id,
      dob: new Date('1988-04-12'),
      gender: 'Male',
      bloodGroup: 'O+',
      medicalNotes: 'Mild hypertension under dietary management. Seasonal pollen allergies.',
      allergies: ['Penicillin', 'Pollen'],
      chronicConditions: ['Hypertension'],
      emergencyContact: {
        name: 'Jane Doe',
        relation: 'Spouse',
        phone: '+1-555-0202'
      }
    });

    // Patient 2
    const pat2User = await User.create({
      name: 'Sarah Smith',
      email: 'sarah.smith@patient.com',
      passwordHash: defaultPassword,
      role: 'Patient',
      phone: '+1-555-0203'
    });

    const patient2 = await Patient.create({
      userId: pat2User._id,
      dob: new Date('1994-09-22'),
      gender: 'Female',
      bloodGroup: 'A+',
      medicalNotes: 'No prior surgical history. Frequent tension headaches.',
      allergies: ['Sulfa drugs'],
      chronicConditions: ['Migraine'],
      emergencyContact: {
        name: 'Robert Smith',
        relation: 'Father',
        phone: '+1-555-0204'
      }
    });

    console.log('[Seeder]: Creating Appointments and Clinical Records...');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const pastDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

    // Past Completed Appointment (Patient 1 with Doctor 1)
    const appt1 = await Appointment.create({
      patientId: patient1._id,
      doctorId: doctor1._id,
      departmentId: cardiology._id,
      appointmentDate: pastDate,
      slotTime: '09:30 - 10:00',
      status: 'Completed',
      reason: 'Routine cardiac health review and chest tightness check',
      remarks: 'Patient responded well to initial exam. Prescription issued.'
    });

    // Billing for past completed appointment
    await Billing.create({
      appointmentId: appt1._id,
      patientId: patient1._id,
      doctorId: doctor1._id,
      invoiceNumber: 'INV-2026-001',
      amount: 120,
      tax: 12,
      totalAmount: 132,
      paymentStatus: 'Paid',
      paymentMethod: 'Credit Card',
      paidAt: new Date(Date.now() - 3 * 86400000),
      transactionId: 'TXN-CARD-994821'
    });

    // Prescription for past appointment
    await Prescription.create({
      appointmentId: appt1._id,
      patientId: patient1._id,
      doctorId: doctor1._id,
      diagnosis: 'Mild Essential Hypertension with Sinus Tachycardia',
      medicines: [
        {
          name: 'Amlodipine Besylate',
          dosage: '5mg',
          frequency: 'Once daily in the morning',
          duration: '30 days',
          instructions: 'Take with or without food. Monitor morning BP weekly.'
        },
        {
          name: 'Atorvastatin',
          dosage: '10mg',
          frequency: 'Once daily at bedtime',
          duration: '30 days',
          instructions: 'Take after dinner with water.'
        }
      ],
      notes: 'Follow low-sodium DASH diet. Walk 30 minutes daily. Return in 4 weeks for follow-up.',
      followUpDate: new Date(Date.now() + 25 * 86400000),
      issuedAt: new Date(Date.now() - 3 * 86400000)
    });

    // Upcoming Confirmed Appointment (Patient 2 with Doctor 2)
    const appt2 = await Appointment.create({
      patientId: patient2._id,
      doctorId: doctor2._id,
      departmentId: neurology._id,
      appointmentDate: tomorrow,
      slotTime: '10:00 - 10:30',
      status: 'Confirmed',
      reason: 'Recurring migraine headache consultations',
      remarks: 'Confirmed by receptionist.'
    });

    await Billing.create({
      appointmentId: appt2._id,
      patientId: patient2._id,
      doctorId: doctor2._id,
      invoiceNumber: 'INV-2026-002',
      amount: 110,
      tax: 11,
      totalAmount: 121,
      paymentStatus: 'Pending',
      paymentMethod: 'Pending'
    });

    // Upcoming Booked Appointment (Patient 1 with Doctor 3)
    const appt3 = await Appointment.create({
      patientId: patient1._id,
      doctorId: doctor3._id,
      departmentId: orthopedics._id,
      appointmentDate: today,
      slotTime: '11:00 - 11:30',
      status: 'Booked',
      reason: 'Right knee joint pain after jogging',
      remarks: 'Booked online via patient portal'
    });

    await Billing.create({
      appointmentId: appt3._id,
      patientId: patient1._id,
      doctorId: doctor3._id,
      invoiceNumber: 'INV-2026-003',
      amount: 100,
      tax: 10,
      totalAmount: 110,
      paymentStatus: 'Pending',
      paymentMethod: 'Pending'
    });

    // Notifications
    await Notification.create([
      {
        userId: pat1User._id,
        appointmentId: appt3._id,
        title: 'Appointment Booked',
        message: `Your appointment with Dr. Michael Chen is scheduled for ${today} at 11:00 - 11:30.`,
        type: 'Booking',
        isRead: false
      },
      {
        userId: pat2User._id,
        appointmentId: appt2._id,
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. Ananya Patel for tomorrow (${tomorrow}) at 10:00 - 10:30 is confirmed.`,
        type: 'Reminder',
        isRead: false
      }
    ]);

    console.log('----------------------------------------------------');
    console.log('[Seeder Successful]: Sample data populated!');
    console.log('Sample Credentials for Viva & Evaluation:');
    console.log('  Admin:        admin@hospital.com       | password123');
    console.log('  Doctor 1:     dr.sharma@hospital.com   | password123 (Cardiology)');
    console.log('  Doctor 2:     dr.patel@hospital.com    | password123 (Neurology)');
    console.log('  Doctor 3:     dr.chen@hospital.com     | password123 (Orthopedics)');
    console.log('  Patient 1:    john.doe@patient.com     | password123');
    console.log('  Patient 2:    sarah.smith@patient.com  | password123');
    console.log('----------------------------------------------------');

    if (shouldExit) {
      await disconnectDB();
      process.exit(0);
    }
  } catch (err) {
    console.error('[Seeder Error]:', err);
    if (shouldExit) process.exit(1);
    throw err;
  }
};

if (require.main === module) {
  seedData(true);
}

module.exports = seedData;

