const assert = require('assert');
const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

// Ensure test port
process.env.PORT = '5001';
process.env.NODE_ENV = 'test';

const { connectDB, disconnectDB } = require('../config/db');
const app = require('../server');

let server;
let baseUrl = 'http://127.0.0.1:5001';

// Helper for making HTTP JSON requests
const request = ({ method, path, body, token }) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
};

const runTests = async () => {
  console.log('\n======================================================');
  console.log('STARTING INTEGRATION TEST SUITE: 13 MODULE VERIFICATION');
  console.log('======================================================\n');

  try {
    const seedData = require('../utils/seeder');
    await seedData(false);

    await new Promise((resolve) => {
      server = app.listen(5001, '127.0.0.1', () => {
        console.log('[Test Setup]: Test server successfully bound to 127.0.0.1:5001');
        resolve();
      });
    });

    let adminToken, doctorToken, patientToken;
    let doctorId, patientId, testAppointmentId;

    // TEST 1: Health Check Endpoint
    console.log('Testing: API Health Check (GET /api/health)');
    const healthRes = await request({ method: 'GET', path: '/api/health' });
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.success, true);
    console.log('  PASS: Health check responded 200 OK');

    // TEST 2: Validation Failure handling (400)
    console.log('Testing: Validation Error Handler (POST /api/auth/login with empty body)');
    const badLoginRes = await request({ method: 'POST', path: '/api/auth/login', body: {} });
    assert.strictEqual(badLoginRes.status, 400);
    assert.strictEqual(badLoginRes.body.errorCode, 'VALIDATION_ERROR');
    console.log('  PASS: Rejected with 400 and VALIDATION_ERROR');

    // TEST 3: Admin Login
    console.log('Testing: Admin Authentication (POST /api/auth/login)');
    const adminLoginRes = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'admin@hospital.com', password: 'password123' }
    });
    assert.strictEqual(adminLoginRes.status, 200);
    assert.ok(adminLoginRes.body.data.token);
    adminToken = adminLoginRes.body.data.token;
    console.log('  PASS: Admin logged in, JWT received');

    // TEST 4: Doctor Login
    console.log('Testing: Doctor Authentication (POST /api/auth/login)');
    const docLoginRes = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'dr.sharma@hospital.com', password: 'password123' }
    });
    assert.strictEqual(docLoginRes.status, 200);
    doctorToken = docLoginRes.body.data.token;
    doctorId = docLoginRes.body.data.profile._id;
    console.log(`  PASS: Doctor logged in (Doctor ID: ${doctorId})`);

    // TEST 5: Patient Registration & Login (Module 1)
    console.log('Testing: Patient Registration (POST /api/auth/register)');
    const randomSuffix = Math.floor(Math.random() * 10000);
    const registerRes = await request({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: `Test Patient ${randomSuffix}`,
        email: `testpatient${randomSuffix}@test.com`,
        password: 'password123',
        phone: '+1-555-9988',
        role: 'Patient',
        gender: 'Female',
        bloodGroup: 'B+',
        dob: '1998-05-15',
        medicalNotes: 'No previous conditions.'
      }
    });
    assert.strictEqual(registerRes.status, 201);
    assert.ok(registerRes.body.data.token);
    assert.strictEqual(registerRes.body.data.user.role, 'Patient');
    patientToken = registerRes.body.data.token;
    patientId = registerRes.body.data.profile._id;
    console.log(`  PASS: Patient registered successfully (Patient ID: ${patientId})`);

    // TEST 6: Authentication Failure (401)
    console.log('Testing: Authentication Guard (GET /api/appointments without token)');
    const noTokenRes = await request({ method: 'GET', path: '/api/appointments' });
    assert.strictEqual(noTokenRes.status, 401);
    assert.strictEqual(noTokenRes.body.errorCode, 'UNAUTHENTICATED');
    console.log('  PASS: 401 UNAUTHENTICATED returned');

    // TEST 7: Role-Based Authorization Guard (403)
    console.log('Testing: RBAC Authorization Guard (GET /api/admin/dashboard as Patient)');
    const forbiddenRes = await request({
      method: 'GET',
      path: '/api/admin/dashboard',
      token: patientToken
    });
    assert.strictEqual(forbiddenRes.status, 403);
    assert.strictEqual(forbiddenRes.body.errorCode, 'FORBIDDEN');
    console.log('  PASS: 403 FORBIDDEN correctly rejected patient accessing admin route');

    // TEST 8: Department & Specialization Directory (Module 2 & 8)
    console.log('Testing: Department Directory (GET /api/departments)');
    const deptsRes = await request({ method: 'GET', path: '/api/departments' });
    assert.strictEqual(deptsRes.status, 200);
    assert.ok(Array.isArray(deptsRes.body.data));
    console.log(`  PASS: Directory returned ${deptsRes.body.count} departments`);

    // TEST 9: Search Doctors by Specialization (Module 11)
    console.log('Testing: Search Doctors (GET /api/doctors?specialization=Cardiology)');
    const docSearchRes = await request({ method: 'GET', path: '/api/doctors?specialization=Cardiology' });
    assert.strictEqual(docSearchRes.status, 200);
    assert.ok(docSearchRes.body.count >= 1);
    console.log(`  PASS: Found ${docSearchRes.body.count} matching cardiologist(s)`);

    // TEST 10: Appointment Booking Engine (Module 4)
    console.log('Testing: Conflict-free Appointment Booking (POST /api/appointments)');
    const futureDate = '2026-09-15';
    const testSlot = '10:00 - 10:30';

    const bookRes = await request({
      method: 'POST',
      path: '/api/appointments',
      token: patientToken,
      body: {
        doctorId: doctorId,
        appointmentDate: futureDate,
        slotTime: testSlot,
        reason: 'Severe chest discomfort after running'
      }
    });
    assert.strictEqual(bookRes.status, 201);
    assert.strictEqual(bookRes.body.data.appointment.status, 'Booked');
    assert.ok(bookRes.body.data.billing);
    testAppointmentId = bookRes.body.data.appointment._id;
    console.log(`  PASS: Appointment booked with linked billing ID: ${bookRes.body.data.billing._id}`);

    // TEST 11: Business Rule Conflict (Double Booking -> 409 Conflict)
    console.log('Testing: Double Booking Conflict Detection (POST /api/appointments on same slot)');
    const conflictRes = await request({
      method: 'POST',
      path: '/api/appointments',
      token: patientToken,
      body: {
        doctorId: doctorId,
        appointmentDate: futureDate,
        slotTime: testSlot,
        reason: 'Duplicate slot booking test'
      }
    });
    assert.strictEqual(conflictRes.status, 409);
    assert.strictEqual(conflictRes.body.errorCode, 'SLOT_ALREADY_BOOKED');
    console.log('  PASS: Double booking rejected with 409 SLOT_ALREADY_BOOKED');

    // TEST 12: Appointment Status Workflow Engine (Module 5)
    console.log('Testing: Appointment Status Transition (PUT /api/appointments/:id/status to Confirmed)');
    const confirmRes = await request({
      method: 'PUT',
      path: `/api/appointments/${testAppointmentId}/status`,
      token: doctorToken,
      body: {
        status: 'Confirmed',
        remarks: 'Doctor accepted appointment slot'
      }
    });
    assert.strictEqual(confirmRes.status, 200);
    assert.strictEqual(confirmRes.body.data.status, 'Confirmed');
    console.log('  PASS: Appointment transitioned to Confirmed');

    // TEST 13: Digital Prescription Module (Module 6)
    console.log('Testing: Digital Prescription Issuance (POST /api/prescriptions)');
    const prescRes = await request({
      method: 'POST',
      path: '/api/prescriptions',
      token: doctorToken,
      body: {
        appointmentId: testAppointmentId,
        diagnosis: 'Acute Costochondritis',
        medicines: [
          {
            name: 'Ibuprofen',
            dosage: '400mg',
            frequency: 'Twice daily after food',
            duration: '5 days',
            instructions: 'Take with full glass of water'
          }
        ],
        notes: 'Rest for 3 days. Avoid heavy bench press exercises.'
      }
    });
    assert.strictEqual(prescRes.status, 201);
    assert.strictEqual(prescRes.body.data.diagnosis, 'Acute Costochondritis');
    console.log('  PASS: Prescription issued and linked appointment auto-marked Completed');

    // Verify appointment status updated to Completed
    const apptCheckRes = await request({
      method: 'GET',
      path: `/api/appointments/${testAppointmentId}`,
      token: doctorToken
    });
    assert.strictEqual(apptCheckRes.body.data.appointment.status, 'Completed');
    console.log('  PASS: Verified appointment status is now Completed');

    // TEST 14: Patient Medical History (Module 7)
    console.log('Testing: Patient Medical History (GET /api/patients/:id/history)');
    const historyRes = await request({
      method: 'GET',
      path: `/api/patients/${patientId}/history`,
      token: patientToken
    });
    assert.strictEqual(historyRes.status, 200);
    assert.ok(historyRes.body.data.appointments.length >= 1);
    assert.ok(historyRes.body.data.prescriptions.length >= 1);
    console.log(`  PASS: Retrieved chronological history with ${historyRes.body.data.appointments.length} visit(s) and ${historyRes.body.data.prescriptions.length} prescription(s)`);

    // TEST 15: Billing Summary & Payment (Module 10)
    console.log('Testing: Billing Summary & Pay Invoice (PUT /api/billing/:id/pay)');
    const billingId = bookRes.body.data.billing._id;
    const payRes = await request({
      method: 'PUT',
      path: `/api/billing/${billingId}/pay`,
      token: patientToken,
      body: { paymentMethod: 'UPI' }
    });
    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.data.paymentStatus, 'Paid');
    console.log('  PASS: Invoice paid via UPI');

    // TEST 16: Notifications & Reminders (Module 9)
    console.log('Testing: User Notifications (GET /api/notifications)');
    const notifRes = await request({
      method: 'GET',
      path: '/api/notifications',
      token: patientToken
    });
    assert.strictEqual(notifRes.status, 200);
    assert.ok(notifRes.body.count >= 1);
    console.log(`  PASS: Patient has ${notifRes.body.count} notifications received across the workflow`);

    // TEST 17: Admin Reports & Analytics (Module 12)
    console.log('Testing: Admin Dashboard & Reports (GET /api/admin/dashboard & reports)');
    const dashRes = await request({
      method: 'GET',
      path: '/api/admin/dashboard',
      token: adminToken
    });
    assert.strictEqual(dashRes.status, 200);
    assert.ok(dashRes.body.data.totalAppointments >= 1);
    console.log(`  PASS: Admin dashboard aggregated: Total Appts=${dashRes.body.data.totalAppointments}, Revenue=₹${dashRes.body.data.financials.collectedRevenue}`);

    const deptReportRes = await request({
      method: 'GET',
      path: '/api/admin/reports/departments',
      token: adminToken
    });
    assert.strictEqual(deptReportRes.status, 200);
    assert.ok(deptReportRes.body.data.length >= 1);
    console.log(`  PASS: Department load report returned statistics for ${deptReportRes.body.data.length} departments`);

    console.log('\n======================================================');
    console.log('ALL 17 INTEGRATION TESTS PASSED SUCCESSFULLY! (13/13 MODULES)');
    console.log('======================================================\n');

    server.close();
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n TEST FAILED:', err);
    if (server) server.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
