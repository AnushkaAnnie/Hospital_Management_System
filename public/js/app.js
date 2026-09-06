// PulseCare Frontend State & API Controller
const API_BASE = '/api';

const state = {
  token: localStorage.getItem('pulse_token') || null,
  user: JSON.parse(localStorage.getItem('pulse_user') || 'null'),
  profile: JSON.parse(localStorage.getItem('pulse_profile') || 'null'),
  departments: [],
  doctors: [],
  selectedDepartment: 'all',
  selectedDoctorForBooking: null,
  activeTab: 'directory'
};

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// HTTP API Fetch Helper with JWT Header
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// -------------------------------------------------------------
// Initialization & Authentication Management
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  setupDefaultDate();
  renderUIForAuthState();
  await loadDepartments();
  await loadDoctors();

  // If already authenticated, load role specific data
  if (state.token) {
    onAuthSuccess();
  }
});

function setupDefaultDate() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dateInput = document.getElementById('bookDateInput');
  if (dateInput) {
    dateInput.value = tomorrow;
    dateInput.min = new Date().toISOString().split('T')[0];
  }
}

function renderUIForAuthState() {
  const navUserArea = document.getElementById('navUserArea');
  const userBadgeCard = document.getElementById('userBadgeCard');
  const patientNav = document.getElementById('patientNav');
  const doctorNav = document.getElementById('doctorNav');
  const adminNav = document.getElementById('adminNav');

  if (state.token && state.user) {
    // User is logged in
    navUserArea.innerHTML = `
      <span style="font-size: 0.85rem; font-weight: 600; color: var(--slate);">Hi, ${state.user.name}</span>
      <button class="btn btn-sm btn-outline" onclick="handleLogout()">
        <i class="fa-solid fa-right-from-bracket"></i> Sign Out
      </button>
    `;

    userBadgeCard.style.display = 'flex';
    document.getElementById('userName').textContent = state.user.name;
    document.getElementById('userRole').textContent = state.user.role;
    document.getElementById('userAvatar').textContent = state.user.name.charAt(0).toUpperCase();

    // Show navigation based on role
    patientNav.style.display = (state.user.role === 'Patient') ? 'block' : 'none';
    doctorNav.style.display = (state.user.role === 'Doctor') ? 'block' : 'none';
    adminNav.style.display = (state.user.role === 'Admin' || state.user.role === 'Receptionist') ? 'block' : 'none';
  } else {
    // Guest State
    navUserArea.innerHTML = `
      <button class="btn btn-sm btn-primary" onclick="showAuthModal('login')">
        <i class="fa-solid fa-right-to-bracket"></i> Sign In
      </button>
      <button class="btn btn-sm btn-secondary" onclick="showAuthModal('register')">
        <i class="fa-solid fa-user-plus"></i> Register
      </button>
    `;
    userBadgeCard.style.display = 'none';
    patientNav.style.display = 'none';
    doctorNav.style.display = 'none';
    adminNav.style.display = 'none';
  }
}

// 1-Click Quick Login for Evaluators & Demos
async function quickLogin(email) {
  try {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'password123' })
    });

    setAuthState(res.data.token, res.data.user, res.data.profile);
    showToast(`Logged in as ${res.data.user.role} (${res.data.user.name})`, 'success');
    onAuthSuccess();
  } catch (err) {
    console.error(err);
  }
}

function setAuthState(token, user, profile) {
  state.token = token;
  state.user = user;
  state.profile = profile;
  localStorage.setItem('pulse_token', token);
  localStorage.setItem('pulse_user', JSON.stringify(user));
  localStorage.setItem('pulse_profile', JSON.stringify(profile));
  renderUIForAuthState();
}

function handleLogout() {
  state.token = null;
  state.user = null;
  state.profile = null;
  localStorage.removeItem('pulse_token');
  localStorage.removeItem('pulse_user');
  localStorage.removeItem('pulse_profile');
  renderUIForAuthState();
  switchTab('directory');
  showToast('You have signed out.', 'info');
}

function onAuthSuccess() {
  if (state.user.role === 'Patient') {
    loadMyAppointments();
    loadPatientHistory();
    loadMyBillings();
    loadNotifications();
    switchTab('my-appointments');
  } else if (state.user.role === 'Doctor') {
    loadDoctorAppointments();
    loadDoctorSlots();
    switchTab('doctor-schedule');
  } else if (state.user.role === 'Admin' || state.user.role === 'Receptionist') {
    loadAdminDashboard();
    loadAdminDepartments();
    loadAdminReports();
    switchTab('admin-overview');
  }
}

// Modal Toggle
function showAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  modal.classList.add('active');
  toggleAuthMode(mode);
}

function toggleAuthMode(mode) {
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const title = document.getElementById('authModalTitle');

  if (mode === 'login') {
    tabBtnLogin.classList.add('active');
    tabBtnRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    title.textContent = 'Sign In to PulseCare';
  } else {
    tabBtnLogin.classList.remove('active');
    tabBtnRegister.classList.add('active');
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    title.textContent = 'Register as Patient';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Form Handlers: Auth
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuthState(res.data.token, res.data.user, res.data.profile);
    closeModal('authModal');
    showToast(`Welcome back, ${res.data.user.name}!`, 'success');
    onAuthSuccess();
  } catch (err) {
    // Error handled in apiCall
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    phone: document.getElementById('regPhone').value,
    role: 'Patient',
    dob: document.getElementById('regDob').value,
    gender: document.getElementById('regGender').value,
    bloodGroup: document.getElementById('regBloodGroup').value,
    medicalNotes: document.getElementById('regMedicalNotes').value
  };

  try {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setAuthState(res.data.token, res.data.user, res.data.profile);
    closeModal('authModal');
    showToast('Registration complete! Welcome to PulseCare.', 'success');
    onAuthSuccess();
  } catch (err) {
    // Error handled
  }
}

// Navigation Tab Switcher
function switchTab(tabId) {
  state.activeTab = tabId;

  // Deactivate all tabs
  document.querySelectorAll('.content-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

  // Activate target
  const tabMap = {
    'directory': 'directoryTab',
    'book': 'bookTab',
    'my-appointments': 'myAppointmentsTab',
    'history': 'historyTab',
    'billing': 'billingTab',
    'notifications': 'notificationsTab',
    'doctor-schedule': 'doctorScheduleTab',
    'doctor-slots': 'doctorSlotsTab',
    'admin-overview': 'adminOverviewTab',
    'admin-departments': 'adminDepartmentsTab',
    'admin-reports': 'adminReportsTab'
  };

  const targetEl = document.getElementById(tabMap[tabId]);
  if (targetEl) targetEl.classList.add('active');

  const navLink = document.querySelector(`.nav-link[href="#${tabId}"]`);
  if (navLink) navLink.classList.add('active');
}

// -------------------------------------------------------------
// MODULE 2, 8, 11: Departments & Doctors Directory
// -------------------------------------------------------------
async function loadDepartments() {
  try {
    const res = await apiCall('/departments');
    state.departments = res.data;

    // Render Department Pills
    const container = document.getElementById('deptFilterPills');
    container.innerHTML = `<button class="pill active" onclick="filterByDepartment('all')">All Departments</button>` +
      res.data.map(d => `<button class="pill" onclick="filterByDepartment('${d._id}')">${d.name} (${d.doctorCount})</button>`).join('');

    // Render in Admin Dept table if present
    renderAdminDepartments();
  } catch (err) {
    console.error(err);
  }
}

async function loadDoctors() {
  try {
    const res = await apiCall('/doctors');
    state.doctors = res.data;
    renderDoctorGrid(res.data);
    populateDoctorSelect(res.data);
  } catch (err) {
    console.error(err);
  }
}

function renderDoctorGrid(doctors) {
  const container = document.getElementById('doctorCardsGrid');
  if (!doctors.length) {
    container.innerHTML = `<p class="text-muted">No specialists found matching your search.</p>`;
    return;
  }

  container.innerHTML = doctors.map(doc => `
    <div class="doctor-card">
      <div class="doctor-header">
        <div class="doc-avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="doc-title">
          <h3>${doc.userId ? doc.userId.name : 'Medical Doctor'}</h3>
          <span class="doc-dept">${doc.departmentId ? doc.departmentId.name : 'General Care'}</span>
          <div class="doc-spec">${doc.specialization}</div>
        </div>
      </div>
      <div class="doc-stats">
        <span>Exp: <strong>${doc.experienceYears} Years</strong></span>
        <span>Fee: <strong>₹${doc.consultationFee}</strong></span>
        <span>Slots: <strong>${doc.availabilitySlots.length} Active</strong></span>
      </div>
      <div class="doc-slots-preview">
        <i class="fa-regular fa-clock"></i> Available: ${doc.availabilitySlots.map(s => s.dayOfWeek.slice(0, 3)).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Mon - Fri'}
      </div>
      <button class="btn btn-sm btn-primary" onclick="initiateBooking('${doc._id}')">
        <i class="fa-regular fa-calendar-plus"></i> Book Consultation
      </button>
    </div>
  `).join('');
}

function populateDoctorSelect(doctors) {
  const select = document.getElementById('bookDoctorSelect');
  if (!select) return;
  select.innerHTML = `<option value="">-- Choose Specialist --</option>` +
    doctors.map(d => `<option value="${d._id}" data-fee="${d.consultationFee}">${d.userId.name} - ${d.specialization} (₹${d.consultationFee})</option>`).join('');
}

function filterByDepartment(deptId) {
  state.selectedDepartment = deptId;
  document.querySelectorAll('#deptFilterPills .pill').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');

  const filtered = (deptId === 'all')
    ? state.doctors
    : state.doctors.filter(d => d.departmentId && d.departmentId._id === deptId);

  renderDoctorGrid(filtered);
}

function filterDoctors() {
  const term = document.getElementById('doctorSearchInput').value.toLowerCase();
  const filtered = state.doctors.filter(d => 
    (d.userId && d.userId.name.toLowerCase().includes(term)) ||
    d.specialization.toLowerCase().includes(term) ||
    (d.departmentId && d.departmentId.name.toLowerCase().includes(term))
  );
  renderDoctorGrid(filtered);
}

// -------------------------------------------------------------
// MODULE 4: Conflict-Free Appointment Booking
// -------------------------------------------------------------
function initiateBooking(doctorId) {
  if (!state.token) {
    showToast('Please sign in or register to book an appointment.', 'info');
    showAuthModal('login');
    return;
  }
  switchTab('book');
  const select = document.getElementById('bookDoctorSelect');
  select.value = doctorId;
  onDoctorSelected();
}

function onDoctorSelected() {
  const select = document.getElementById('bookDoctorSelect');
  const doctorId = select.value;
  if (!doctorId) return;

  const doctor = state.doctors.find(d => d._id === doctorId);
  if (doctor) {
    const feeCard = document.getElementById('feeEstimateCard');
    const fee = doctor.consultationFee || 50;
    const tax = Math.round(fee * 0.1 * 100) / 100;
    const total = fee + tax;

    document.getElementById('feeDoctorAmount').textContent = `₹${fee.toFixed(2)}`;
    document.getElementById('feeTaxAmount').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('feeTotalAmount').textContent = `₹${total.toFixed(2)}`;
    feeCard.style.display = 'block';

    fetchAvailableSlots();
  }
}

async function fetchAvailableSlots() {
  const doctorId = document.getElementById('bookDoctorSelect').value;
  const date = document.getElementById('bookDateInput').value;
  const container = document.getElementById('slotsContainer');

  if (!doctorId || !date) return;

  container.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Checking slot availability...</span>';

  try {
    const res = await apiCall(`/doctors/${doctorId}/slots?date=${date}`);
    const slots = res.data.slots;

    if (!slots || !slots.length) {
      container.innerHTML = `<p class="text-muted">No scheduled slots configured by doctor for ${res.data.dayOfWeek}. Please choose another date.</p>`;
      return;
    }

    container.innerHTML = slots.map(s => `
      <button type="button" 
        class="slot-btn ${s.isAvailable ? '' : 'disabled'}" 
        ${s.isAvailable ? '' : 'disabled title="Slot already booked"'}
        onclick="selectSlot('${s.slotTime}', this)">
        ${s.slotTime} ${s.isAvailable ? '' : '(Booked)'}
      </button>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-danger">Unable to load slots.</p>';
  }
}

function selectSlot(slotTime, btn) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('selectedSlotInput').value = slotTime;
}

async function handleBookAppointment(e) {
  e.preventDefault();
  if (!state.token) {
    showToast('Please sign in to proceed with booking.', 'info');
    showAuthModal('login');
    return;
  }

  const doctorId = document.getElementById('bookDoctorSelect').value;
  const appointmentDate = document.getElementById('bookDateInput').value;
  const slotTime = document.getElementById('selectedSlotInput').value;
  const reason = document.getElementById('bookReasonInput').value;

  if (!slotTime) {
    showToast('Please click on an available time slot.', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitBooking');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking Slot...';

  try {
    const res = await apiCall('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        doctorId,
        appointmentDate,
        slotTime,
        reason
      })
    });

    showToast('Appointment successfully scheduled!', 'success');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Confirm & Book Appointment';

    // Refresh slots & switch to appointments tab
    fetchAvailableSlots();
    loadMyAppointments();
    loadMyBillings();
    switchTab('my-appointments');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Confirm & Book Appointment';
  }
}

// -------------------------------------------------------------
// MODULE 5: Appointment Status Workflow Engine
// -------------------------------------------------------------
async function loadMyAppointments() {
  const container = document.getElementById('myAppointmentsList');
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  try {
    const res = await apiCall('/appointments');
    if (!res.data.length) {
      container.innerHTML = `<div class="card"><p class="text-muted">No appointments found. Use the 'Book Appointment' tab to schedule a visit.</p></div>`;
      return;
    }

    container.innerHTML = res.data.map(appt => `
      <div class="appointment-card">
        <div class="appointment-info">
          <h3>Dr. ${appt.doctorId ? appt.doctorId.userId.name : 'Specialist'} - ${appt.departmentId ? appt.departmentId.name : ''}</h3>
          <div class="appointment-meta">
            <span><i class="fa-regular fa-calendar"></i> ${appt.appointmentDate}</span>
            <span><i class="fa-regular fa-clock"></i> ${appt.slotTime}</span>
            <span>Reason: <em>${appt.reason || 'General'}</em></span>
          </div>
        </div>
        <div class="appointment-actions">
          <span class="badge badge-${appt.status.toLowerCase()}">${appt.status}</span>
          ${appt.status === 'Completed' ? `
            <button class="btn btn-xs btn-outline" onclick="viewPrescriptionForAppointment('${appt._id}')">
              <i class="fa-solid fa-file-prescription"></i> View Rx
            </button>
          ` : ''}
          ${['Booked', 'Confirmed'].includes(appt.status) ? `
            <button class="btn btn-xs btn-danger" onclick="cancelAppointment('${appt._id}')">
              <i class="fa-solid fa-ban"></i> Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-danger">Failed to load appointments.</p>';
  }
}

async function cancelAppointment(appointmentId) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;

  try {
    await apiCall(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Cancelled',
        remarks: 'Cancelled by patient'
      })
    });
    showToast('Appointment cancelled successfully.', 'info');
    loadMyAppointments();
  } catch (err) {
    // Handled
  }
}

// -------------------------------------------------------------
// MODULE 6: Digital Prescription Module (Doctor Console)
// -------------------------------------------------------------
async function loadDoctorAppointments() {
  const container = document.getElementById('doctorAppointmentsList');
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading schedule...</div>';

  try {
    const res = await apiCall('/appointments');
    if (!res.data.length) {
      container.innerHTML = `<div class="card"><p class="text-muted">No appointments assigned to you currently.</p></div>`;
      return;
    }

    container.innerHTML = res.data.map(appt => `
      <div class="appointment-card">
        <div class="appointment-info">
          <h3>${appt.patientId ? appt.patientId.userId.name : 'Patient'} (Blood: ${appt.patientId ? appt.patientId.bloodGroup : 'N/A'})</h3>
          <div class="appointment-meta">
            <span><i class="fa-regular fa-calendar"></i> ${appt.appointmentDate}</span>
            <span><i class="fa-regular fa-clock"></i> ${appt.slotTime}</span>
            <span>Reason: <em>${appt.reason || 'General'}</em></span>
          </div>
        </div>
        <div class="appointment-actions">
          <span class="badge badge-${appt.status.toLowerCase()}">${appt.status}</span>
          ${appt.status === 'Booked' ? `
            <button class="btn btn-xs btn-success" onclick="updateDoctorApptStatus('${appt._id}', 'Confirmed')">
              <i class="fa-solid fa-check"></i> Confirm
            </button>
          ` : ''}
          ${['Booked', 'Confirmed'].includes(appt.status) ? `
            <button class="btn btn-xs btn-primary" onclick="openPrescriptionModal('${appt._id}', '${appt.patientId ? appt.patientId.userId.name : 'Patient'}')">
              <i class="fa-solid fa-stethoscope"></i> Issue Rx & Complete
            </button>
            <button class="btn btn-xs btn-outline" onclick="updateDoctorApptStatus('${appt._id}', 'No-show')">
              No-show
            </button>
          ` : ''}
          ${appt.status === 'Completed' ? `
            <button class="btn btn-xs btn-outline" onclick="viewPrescriptionForAppointment('${appt._id}')">
              <i class="fa-solid fa-prescription"></i> View Rx
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-danger">Failed to load doctor appointments.</p>';
  }
}

async function updateDoctorApptStatus(appointmentId, status) {
  try {
    await apiCall(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast(`Appointment status updated to ${status}.`, 'success');
    loadDoctorAppointments();
  } catch (err) {
    // Handled
  }
}

function openPrescriptionModal(appointmentId, patientName) {
  document.getElementById('rxAppointmentId').value = appointmentId;
  const container = document.getElementById('medicinesContainer');
  container.innerHTML = '';
  addMedicineRow(); // Add one initial row
  const modal = document.getElementById('prescriptionModal');
  modal.classList.add('active');
}

function addMedicineRow() {
  const container = document.getElementById('medicinesContainer');
  const div = document.createElement('div');
  div.className = 'form-row mb-2';
  div.innerHTML = `
    <div style="flex: 2;">
      <input type="text" class="med-name" placeholder="Medicine (e.g. Amoxicillin)" required>
    </div>
    <div style="flex: 1;">
      <input type="text" class="med-dosage" placeholder="Dosage (500mg)" required>
    </div>
    <div style="flex: 1;">
      <input type="text" class="med-freq" placeholder="Frequency (1-0-1)" required>
    </div>
    <div style="flex: 1;">
      <input type="text" class="med-dur" placeholder="Duration (5 days)" required>
    </div>
    <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

async function handlePrescriptionSubmit(e) {
  e.preventDefault();
  const appointmentId = document.getElementById('rxAppointmentId').value;
  const diagnosis = document.getElementById('rxDiagnosis').value;
  const notes = document.getElementById('rxNotes').value;
  const followUpDate = document.getElementById('rxFollowUp').value || null;

  const rows = document.querySelectorAll('#medicinesContainer .form-row');
  const medicines = [];
  rows.forEach(r => {
    const name = r.querySelector('.med-name').value;
    const dosage = r.querySelector('.med-dosage').value;
    const frequency = r.querySelector('.med-freq').value;
    const duration = r.querySelector('.med-dur').value;
    if (name && dosage) {
      medicines.push({ name, dosage, frequency, duration });
    }
  });

  if (!medicines.length) {
    showToast('Please add at least one prescribed medicine.', 'error');
    return;
  }

  try {
    await apiCall('/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        appointmentId,
        diagnosis,
        medicines,
        notes,
        followUpDate
      })
    });

    closeModal('prescriptionModal');
    showToast('Prescription issued & appointment marked Completed!', 'success');
    loadDoctorAppointments();
  } catch (err) {
    // Handled
  }
}

async function viewPrescriptionForAppointment(appointmentId) {
  try {
    const res = await apiCall(`/prescriptions/appointment/${appointmentId}`);
    const rx = res.data;

    const body = document.getElementById('prescriptionDetailsBody');
    body.innerHTML = `
      <div class="rx-header">
        <div>
          <h2 style="color: var(--primary);">PulseCare Medical Center</h2>
          <small class="text-muted">Digital Prescription Record</small>
        </div>
        <div style="text-align: right;">
          <strong>Rx Date:</strong> ${new Date(rx.issuedAt).toLocaleDateString()}<br>
          <small class="text-muted">ID: ${rx._id.slice(-6).toUpperCase()}</small>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.85rem;">
        <div>
          <strong>Patient:</strong> ${rx.patientId ? rx.patientId.userId.name : 'Patient'}<br>
          <strong>Blood Group:</strong> ${rx.patientId ? rx.patientId.bloodGroup : 'N/A'}
        </div>
        <div style="text-align: right;">
          <strong>Attending Doctor:</strong> Dr. ${rx.doctorId ? rx.doctorId.userId.name : 'Specialist'}<br>
          <strong>Specialization:</strong> ${rx.doctorId ? rx.doctorId.departmentId.name : ''}
        </div>
      </div>
      <div style="background: #f8fafc; padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
        <strong>Clinical Diagnosis:</strong> <span style="color: var(--dark); font-weight: 600;">${rx.diagnosis}</span>
      </div>
      <h4>Prescribed Medications:</h4>
      <table class="rx-med-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${rx.medicines.map(m => `
            <tr>
              <td><strong>${m.name}</strong></td>
              <td>${m.dosage}</td>
              <td>${m.frequency}</td>
              <td>${m.duration}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${rx.notes ? `<div style="margin-top: 1rem; font-size: 0.85rem;"><strong>Clinical Notes & Advice:</strong> ${rx.notes}</div>` : ''}
      ${rx.followUpDate ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--primary);"><strong>Follow-up Visit:</strong> ${new Date(rx.followUpDate).toLocaleDateString()}</div>` : ''}
    `;

    document.getElementById('viewPrescriptionModal').classList.add('active');
  } catch (err) {
    // Handled
  }
}

// -------------------------------------------------------------
// MODULE 3: Doctor Availability Slots Management
// -------------------------------------------------------------
async function loadDoctorSlots() {
  if (!state.profile || !state.profile._id) return;
  const tbody = document.getElementById('slotsTableBody');
  const slots = state.profile.availabilitySlots || [];

  if (!slots.length) {
    addSlotRow('Monday', '09:00', '13:00');
    return;
  }

  tbody.innerHTML = '';
  slots.forEach(s => addSlotRow(s.dayOfWeek, s.startTime, s.endTime, s.slotDurationMinutes));
}

function addSlotRow(day = 'Monday', start = '09:00', end = '13:00', duration = 30) {
  const tbody = document.getElementById('slotsTableBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="slot-day" style="padding: 0.35rem;">
        ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => `<option value="${d}" ${d === day ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    </td>
    <td><input type="time" class="slot-start" value="${start}" required style="padding: 0.35rem;"></td>
    <td><input type="time" class="slot-end" value="${end}" required style="padding: 0.35rem;"></td>
    <td>
      <select class="slot-dur" style="padding: 0.35rem;">
        <option value="15" ${duration == 15 ? 'selected' : ''}>15 mins</option>
        <option value="30" ${duration == 30 ? 'selected' : ''}>30 mins</option>
        <option value="45" ${duration == 45 ? 'selected' : ''}>45 mins</option>
        <option value="60" ${duration == 60 ? 'selected' : ''}>60 mins</option>
      </select>
    </td>
    <td>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.closest('tr').remove()">&times; Remove</button>
    </td>
  `;
  tbody.appendChild(tr);
}

async function handleSaveSlots(e) {
  e.preventDefault();
  const rows = document.querySelectorAll('#slotsTableBody tr');
  const availabilitySlots = [];

  rows.forEach(r => {
    availabilitySlots.push({
      dayOfWeek: r.querySelector('.slot-day').value,
      startTime: r.querySelector('.slot-start').value,
      endTime: r.querySelector('.slot-end').value,
      slotDurationMinutes: Number(r.querySelector('.slot-dur').value),
      maxPatientsPerSlot: 1,
      isActive: true
    });
  });

  try {
    await apiCall(`/doctors/${state.profile._id}/slots`, {
      method: 'PUT',
      body: JSON.stringify({ availabilitySlots })
    });
    showToast('Doctor availability schedule updated successfully!', 'success');
  } catch (err) {
    // Handled
  }
}

// -------------------------------------------------------------
// MODULE 7: Patient Medical History
// -------------------------------------------------------------
async function loadPatientHistory() {
  if (!state.profile || !state.profile._id) return;
  const container = document.getElementById('patientHistoryContainer');
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  try {
    const res = await apiCall(`/patients/${state.profile._id}/history`);
    const history = res.data;

    container.innerHTML = `
      <div class="card mb-4" style="background: #f8fafc;">
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <div><strong>Patient:</strong> ${history.patient.name}</div>
          <div><strong>Blood Group:</strong> ${history.patient.bloodGroup}</div>
          <div><strong>DOB:</strong> ${new Date(history.patient.dob).toLocaleDateString()}</div>
          <div><strong>Allergies:</strong> ${history.patient.allergies.join(', ') || 'None noted'}</div>
          <div><strong>Visits:</strong> ${history.summary.completedVisits} Completed</div>
        </div>
      </div>
      <h3>Chronological Visit Timeline</h3>
      <div class="history-timeline mt-4">
        ${history.appointments.map(appt => `
          <div class="timeline-item">
            <div class="timeline-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="font-size: 1rem; color: var(--dark);">Visit with Dr. ${appt.doctorId ? appt.doctorId.userId.name : 'Specialist'} (${appt.departmentId ? appt.departmentId.name : ''})</h4>
                  <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${appt.appointmentDate} at ${appt.slotTime}</small>
                </div>
                <span class="badge badge-${appt.status.toLowerCase()}">${appt.status}</span>
              </div>
              <p style="margin: 0.5rem 0; font-size: 0.85rem;"><strong>Chief Complaint:</strong> ${appt.reason || 'General Consultation'}</p>
              ${appt.remarks ? `<p style="font-size: 0.825rem; color: var(--muted);"><strong>Clinical Remarks:</strong> ${appt.remarks}</p>` : ''}
              ${appt.status === 'Completed' ? `
                <div style="margin-top: 0.5rem;">
                  <button class="btn btn-xs btn-outline" onclick="viewPrescriptionForAppointment('${appt._id}')">
                    <i class="fa-solid fa-file-prescription"></i> View Prescription
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p class="text-danger">Failed to load history records.</p>';
  }
}

// -------------------------------------------------------------
// MODULE 10: Billing & Payments
// -------------------------------------------------------------
async function loadMyBillings() {
  const tbody = document.getElementById('billingTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading invoices...</td></tr>';

  try {
    const res = await apiCall('/billing/my');
    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No invoices generated yet.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(b => `
      <tr>
        <td><strong>#${b.invoiceNumber}</strong></td>
        <td>Dr. ${b.doctorId ? b.doctorId.userId.name : 'Specialist'}</td>
        <td>₹${b.amount.toFixed(2)}</td>
        <td>₹${b.tax.toFixed(2)}</td>
        <td><strong class="text-primary">₹${b.totalAmount.toFixed(2)}</strong></td>
        <td><span class="badge badge-${b.paymentStatus.toLowerCase()}">${b.paymentStatus}</span></td>
        <td>
          ${b.paymentStatus === 'Pending' ? `
            <button class="btn btn-xs btn-success" onclick="payBill('${b._id}')">
              <i class="fa-solid fa-credit-card"></i> Pay Now
            </button>
          ` : `
            <span class="text-muted" style="font-size: 0.8rem;"><i class="fa-solid fa-check"></i> Paid (${b.paymentMethod})</span>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center">Failed to load billing invoices.</td></tr>';
  }
}

async function payBill(billingId) {
  try {
    await apiCall(`/billing/${billingId}/pay`, {
      method: 'PUT',
      body: JSON.stringify({ paymentMethod: 'UPI' })
    });
    showToast('Payment successful! Consultation invoice cleared.', 'success');
    loadMyBillings();
    loadNotifications();
  } catch (err) {
    // Handled
  }
}

// -------------------------------------------------------------
// MODULE 9: Notifications & Reminders
// -------------------------------------------------------------
async function loadNotifications() {
  try {
    const res = await apiCall('/notifications');
    const badge = document.getElementById('notifBadge');
    if (res.unreadCount > 0) {
      badge.textContent = res.unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    const container = document.getElementById('notificationsList');
    if (!res.data.length) {
      container.innerHTML = '<div class="card"><p class="text-muted">No alerts or notifications yet.</p></div>';
      return;
    }

    container.innerHTML = res.data.map(n => `
      <div class="card" style="border-left: 4px solid ${n.isRead ? 'var(--border)' : 'var(--primary)'};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 0.95rem; color: var(--dark);">${n.title}</h4>
          <small class="text-muted">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        </div>
        <p style="font-size: 0.85rem; color: var(--slate); margin-top: 0.25rem;">${n.message}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiCall('/notifications/read-all', { method: 'PUT' });
    showToast('All notifications marked as read', 'success');
    loadNotifications();
  } catch (err) {
    // Handled
  }
}

async function triggerReminders() {
  try {
    const res = await apiCall('/notifications/reminders/trigger', { method: 'POST' });
    showToast(res.message, 'success');
  } catch (err) {
    // Handled
  }
}

// -------------------------------------------------------------
// MODULE 12: Admin Dashboard & Reports
// -------------------------------------------------------------
async function loadAdminDashboard() {
  try {
    const res = await apiCall('/admin/dashboard');
    const d = res.data;

    document.getElementById('kpiTotalPatients').textContent = d.totalPatients;
    document.getElementById('kpiTotalDoctors').textContent = d.totalDoctors;
    document.getElementById('kpiTotalAppointments').textContent = d.totalAppointments;
    document.getElementById('kpiTotalRevenue').textContent = `₹${d.financials.collectedRevenue.toFixed(0)}`;

    // Status Bars
    const statusContainer = document.getElementById('statusBarsContainer');
    const total = d.totalAppointments || 1;
    statusContainer.innerHTML = `
      <div style="margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>Completed Visits</span>
          <strong>${d.statusBreakdown.completed} (${Math.round(d.statusBreakdown.completed / total * 100)}%)</strong>
        </div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 0.25rem;">
          <div style="width: ${d.statusBreakdown.completed / total * 100}%; background: var(--success); height: 100%;"></div>
        </div>
      </div>
      <div style="margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>Booked / Scheduled</span>
          <strong>${d.statusBreakdown.booked} (${Math.round(d.statusBreakdown.booked / total * 100)}%)</strong>
        </div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 0.25rem;">
          <div style="width: ${d.statusBreakdown.booked / total * 100}%; background: var(--warning); height: 100%;"></div>
        </div>
      </div>
      <div style="margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>Cancelled</span>
          <strong>${d.statusBreakdown.cancelled} (${Math.round(d.statusBreakdown.cancelled / total * 100)}%)</strong>
        </div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 0.25rem;">
          <div style="width: ${d.statusBreakdown.cancelled / total * 100}%; background: var(--danger); height: 100%;"></div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function renderAdminDepartments() {
  const tbody = document.getElementById('adminDeptTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.departments.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.description}</td>
      <td><span class="badge badge-info">${d.doctorCount} Doctors</span></td>
      <td><span class="badge badge-completed">Active</span></td>
    </tr>
  `).join('');
}

function showCreateDeptModal() {
  document.getElementById('createDeptModal').classList.add('active');
}

async function handleCreateDepartment(e) {
  e.preventDefault();
  const name = document.getElementById('newDeptName').value;
  const description = document.getElementById('newDeptDesc').value;

  try {
    await apiCall('/departments', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    closeModal('createDeptModal');
    showToast(`Department '${name}' created successfully!`, 'success');
    await loadDepartments();
  } catch (err) {
    // Handled
  }
}

async function loadAdminReports() {
  try {
    const res = await apiCall('/admin/reports/doctors');
    const tbody = document.getElementById('adminDoctorUtilizationBody');
    if (!tbody) return;

    tbody.innerHTML = res.data.map(d => `
      <tr>
        <td><strong>Dr. ${d.doctorName}</strong></td>
        <td>${d.specialization} (${d.department})</td>
        <td>${d.totalAppointments}</td>
        <td>${d.completedAppointments}</td>
        <td>₹${d.consultationFee}</td>
        <td><strong class="text-primary">₹${d.revenueGenerated}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}
