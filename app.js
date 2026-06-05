(function () {
  'use strict';

  // ===== DATA LAYER (localStorage) =====
  const DATA_KEY = 'dentcare_data';
  const defaultData = {
    appointments: [],
    patients: [],
    blockedSlots: {},
    nextId: 1
  };

  function loadData() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure blockedSlots exists for backward compat
        if (!parsed.blockedSlots) parsed.blockedSlots = {};
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(defaultData));
  }

  function saveData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  let db = loadData();

  // ===== HELPERS =====
  function formatDate(date) {
    const d = new Date(date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function formatTime(hour) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return h + ':00 ' + ampm;
  }

  function getWeekId(dateStr) {
    // week id: year-W## (ISO-like but simpler: just the week number)
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = (d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000) / 86400000;
    const week = Math.ceil((diff + start.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + String(week).padStart(2, '0');
  }

  function getDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // ===== DOM REFS =====
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const sections = {
    home: $('#section-home'),
    book: $('#section-book'),
    appointments: $('#section-appointments'),
    dashboard: $('#section-dashboard'),
    contact: $('#section-contact')
  };

  const navLinks = $$('.nav-links a[data-nav]');
  const footerLinks = $$('.footer a[data-nav]');
  const ctaLinks = $$('[data-nav]');

  const hamburger = $('#hamburger');
  const navUl = $('#navLinks');
  const loginBtn = $('#loginBtn');
  const loginModal = $('#loginModal');
  const loginModalClose = $('#loginModalClose');
  const loginForm = $('#loginForm');
  const signupForm = $('#signupForm');
  const showSignup = $('#showSignup');
  const showLogin = $('#showLogin');
  const mtabBtns = $$('.mtab-btn');
  const confirmModal = $('#confirmModal');
  const confirmModalClose = $('#confirmModalClose');
  const confirmCloseBtn = $('#confirmCloseBtn');
  const confirmDetails = $('#confirmDetails');
  const bookConfirmBtn = $('#bookConfirmBtn');

  // Calendar
  const dateInput = $('#date-input');
  const calendarWidget = $('#calendarWidget');
  const prevMonthBtn = $('#prevMonth');
  const nextMonthBtn = $('#nextMonth');
  const calendarMonthYear = $('#calendarMonthYear');
  const calendarDays = $('#calendarDays');
  const timeSlots = $('#timeSlots');

  // Booking
  const treatment = $('#treatment');
  const doctor = $('#doctor');
  const notes = $('#notes');
  const summaryTreatment = $('#summaryTreatment');
  const summaryDoctor = $('#summaryDoctor');
  const summaryDate = $('#summaryDate');
  const summaryTime = $('#summaryTime');
  const summaryPrice = $('#summaryPrice');
  const summaryDetails = $('#summaryDetails');

  // Appointments
  const appointmentsList = $('#appointmentsList');
  const apptTabBtns = $$('.appt-tabs .tab-btn');

  // Dashboard
  const statToday = $('#statToday');
  const statWeek = $('#statWeek');
  const statTotal = $('#statTotal');
  const statPatients = $('#statPatients');
  const dashAppts = $('#dashAppointmentsList');
  const dashTabBtns = $$('.dashboard-tabs .tab-btn');
  const slotsGrid = $('#slotsGrid');
  const patientsList = $('#patientsList');

  // Contact
  const contactForm = $('#contactForm');

  // ===== STATE =====
  let currentView = 'home';
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let selectedDate = null;
  let selectedSlot = null;
  let loggedIn = false;
  let currentPatientTab = 'upcoming';

  // ===== NAVIGATION =====
  function navigate(view) {
    if (view === currentView) return;
    currentView = view;
    Object.keys(sections).forEach(key => {
      sections[key].classList.toggle('active', key === view);
    });
    navLinks.forEach(a => {
      const nav = a.getAttribute('data-nav');
      a.classList.toggle('active', nav === view || (nav === 'home' && view === 'home'));
    });
    // Update login button text
    loginBtn.textContent = loggedIn ? 'My Account' : 'Login';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Close mobile nav
    navUl.classList.remove('open');

    // Refresh content per view
    if (view === 'appointments') renderAppointments();
    if (view === 'dashboard') renderDashboard();
    if (view === 'book') renderCalendar();
  }

  // Event delegation for all data-nav clicks
  document.addEventListener('click', function (e) {
    const link = e.target.closest('[data-nav]');
    if (link) {
      e.preventDefault();
      const nav = link.getAttribute('data-nav');
      if (nav) navigate(nav);
    }
  });

  // ===== HAMBURGER =====
  hamburger.addEventListener('click', function () {
    navUl.classList.toggle('open');
  });

  // Close nav on link click (mobile)
  $$('.nav-links a').forEach(a => {
    a.addEventListener('click', function () {
      navUl.classList.remove('open');
    });
  });

  // ===== LOGIN MODAL =====
  loginBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (loggedIn) {
      // Just toggle account state for demo
      loggedIn = false;
      loginBtn.textContent = 'Login';
      db = loadData();
      renderAppointments();
      renderDashboard();
      return;
    }
    openModal('login');
  });

  function openModal(type) {
    if (type === 'login') loginModal.classList.add('open');
    if (type === 'confirm') confirmModal.classList.add('open');
  }

  function closeModal(type) {
    if (type === 'login') loginModal.classList.remove('open');
    if (type === 'confirm') confirmModal.classList.remove('open');
  }

  loginModalClose.addEventListener('click', () => closeModal('login'));
  loginModal.addEventListener('click', function (e) {
    if (e.target === this) closeModal('login');
  });

  // Modal tabs
  mtabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      mtabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Show signup / login toggle
  showSignup.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });
  showLogin.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  });

  // Login / Signup simulation
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loggedIn = true;
    loginBtn.textContent = 'My Account';
    closeModal('login');
    navigate('appointments');
  });

  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loggedIn = true;
    loginBtn.textContent = 'My Account';
    closeModal('login');
    // Add a sample patient
    const name = this.querySelector('input[type="text"]').value || 'New Patient';
    if (!db.patients.find(p => p.name === name)) {
      db.patients.push({ name: name, email: this.querySelector('input[type="email"]').value, visits: 0 });
      saveData(db);
    }
    navigate('appointments');
  });

  // ===== CONFIRM MODAL =====
  confirmModalClose.addEventListener('click', () => closeModal('confirm'));
  confirmCloseBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal('confirm'); });
  confirmModal.addEventListener('click', function (e) {
    if (e.target === this) closeModal('confirm');
  });

  // ===== CALENDAR =====
  function renderCalendar() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    calendarMonthYear.textContent = monthNames[currentMonth] + ' ' + currentYear;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

    let html = '<div class="calendar-weekdays">';
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    weekdays.forEach(d => { html += '<span>' + d + '</span>'; });
    html += '</div>';

    const today = new Date();
    const todayStr = getDateStr(today);
    const currentMonthStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');

    // Previous month days
    let dayCount = 1;
    for (let i = firstDay; i > 0; i--) {
      const day = daysInPrev - i + 1;
      html += '<span class="other-month">' + day + '</span>';
      dayCount++;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = currentMonthStr + '-' + String(d).padStart(2, '0');
      const isToday = dateStr === todayStr;
      const isSelected = selectedDate === dateStr;
      const isPast = dateStr < todayStr;
      const classes = [];
      if (isToday) classes.push('today');
      if (isSelected) classes.push('selected');
      if (isPast) classes.push('disabled');
      html += '<span data-date="' + dateStr + '" class="' + classes.join(' ') + '">' + d + '</span>';
      dayCount++;
    }

    // Fill remaining
    const remaining = 7 - (dayCount % 7 || 7);
    for (let i = 1; i <= remaining; i++) {
      html += '<span class="other-month">' + i + '</span>';
    }

    calendarDays.innerHTML = html;

    // Bind click
    $$('.calendar-days span:not(.other-month):not(.disabled)').forEach(el => {
      el.addEventListener('click', function () {
        const date = this.getAttribute('data-date');
        if (!date) return;
        selectedDate = date;
        selectedSlot = null;
        $$('.calendar-days span').forEach(sp => sp.classList.remove('selected'));
        this.classList.add('selected');
        dateInput.value = formatDate(date);
        calendarWidget.classList.remove('open');
        renderTimeSlots(date);
        updateSummary();
      });
    });
  }

  function renderTimeSlots(dateStr) {
    const slots = ['8','9','10','11','13','14','15','16','17'];
    const blocked = db.blockedSlots[dateStr] || [];
    let html = '';
    slots.forEach(h => {
      const isBlocked = blocked.indexOf(h) !== -1;
      const cls = isBlocked ? 'slot-btn blocked' : 'slot-btn';
      html += '<button class="' + cls + '" data-hour="' + h + '"' + (isBlocked ? ' disabled' : '') + '>' + formatTime(parseInt(h)) + '</button>';
    });
    timeSlots.innerHTML = html;

    $$('.slot-btn:not(.blocked)').forEach(btn => {
      btn.addEventListener('click', function () {
        $$('.slot-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        selectedSlot = this.getAttribute('data-hour');
        updateSummary();
      });
    });
  }

  // Toggle calendar
  dateInput.addEventListener('click', function () {
    calendarWidget.classList.toggle('open');
    renderCalendar();
  });

  // Close calendar when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.calendar-widget') && !e.target.closest('#date-input')) {
      calendarWidget.classList.remove('open');
    }
  });

  prevMonthBtn.addEventListener('click', function () {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  nextMonthBtn.addEventListener('click', function () {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  // ===== BOOKING SUMMARY =====
  function updateSummary() {
    const t = treatment.value;
    const d = doctor.value;
    const date = selectedDate;
    const slot = selectedSlot;

    if (!t || !date || !slot) {
      summaryDetails.style.display = 'none';
      return;
    }

    summaryDetails.style.display = 'block';

    const treatmentNames = {
      'cleaning': 'Teeth Cleaning — $80',
      'filling': 'Filling — $150',
      'whitening': 'Whitening — $200',
      'extraction': 'Extraction — $180',
      'root-canal': 'Root Canal — $350',
      'checkup': 'Checkup — $60'
    };

    const doctorNames = {
      'any': 'Any Available',
      'dr-smith': 'Dr. Sarah Smith',
      'dr-jones': 'Dr. Michael Jones',
      'dr-lee': 'Dr. Emily Lee'
    };

    const prices = {
      'cleaning': 80, 'filling': 150, 'whitening': 200,
      'extraction': 180, 'root-canal': 350, 'checkup': 60
    };

    summaryTreatment.textContent = treatmentNames[t] || t;
    summaryDoctor.textContent = doctorNames[d] || d;
    summaryDate.textContent = formatDate(date);
    summaryTime.textContent = formatTime(parseInt(slot));
    summaryPrice.textContent = '$' + prices[t];
  }

  treatment.addEventListener('change', updateSummary);
  doctor.addEventListener('change', updateSummary);

  // ===== CONFIRM BOOKING =====
  bookConfirmBtn.addEventListener('click', function () {
    const t = treatment.value;
    const d = doctor.value;
    const date = selectedDate;
    const slot = selectedSlot;
    const note = notes.value;

    if (!t) { alert('Please select a treatment type.'); return; }
    if (!date) { alert('Please select a date.'); return; }
    if (!slot) { alert('Please select a time slot.'); return; }

    const prices = {
      'cleaning': 80, 'filling': 150, 'whitening': 200,
      'extraction': 180, 'root-canal': 350, 'checkup': 60
    };

    const treatmentNames = {
      'cleaning': 'Teeth Cleaning', 'filling': 'Filling', 'whitening': 'Whitening',
      'extraction': 'Extraction', 'root-canal': 'Root Canal', 'checkup': 'Checkup'
    };

    const doctorNames = {
      'any': 'Any Available', 'dr-smith': 'Dr. Sarah Smith',
      'dr-jones': 'Dr. Michael Jones', 'dr-lee': 'Dr. Emily Lee'
    };

    const appointment = {
      id: db.nextId++,
      treatment: treatmentNames[t] || t,
      doctor: doctorNames[d] || d,
      date: date,
      time: slot,
      timeFormatted: formatTime(parseInt(slot)),
      notes: note || '',
      price: prices[t] || 0,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    db.appointments.push(appointment);
    saveData(db);

    // Show confirmation modal
    let detailHtml = '';
    detailHtml += '<p><strong>Treatment:</strong> ' + appointment.treatment + '</p>';
    detailHtml += '<p><strong>Doctor:</strong> ' + appointment.doctor + '</p>';
    detailHtml += '<p><strong>Date:</strong> ' + formatDate(date) + '</p>';
    detailHtml += '<p><strong>Time:</strong> ' + appointment.timeFormatted + '</p>';
    detailHtml += '<p><strong>Price:</strong> $' + appointment.price + '</p>';
    confirmDetails.innerHTML = detailHtml;

    openModal('confirm');

    // Reset form
    treatment.value = '';
    doctor.value = 'any';
    dateInput.value = '';
    notes.value = '';
    selectedDate = null;
    selectedSlot = null;
    summaryDetails.style.display = 'none';
    timeSlots.innerHTML = '<p class="hint">Please select a date first</p>';
  });

  // ===== MY APPOINTMENTS =====
  function renderAppointments() {
    const tab = currentPatientTab;
    let list = db.appointments;

    if (tab === 'upcoming') {
      list = list.filter(a => a.status === 'confirmed');
    } else {
      list = list.filter(a => a.status !== 'confirmed');
    }

    // Also add some sample data if empty for demo
    if (db.appointments.length === 0) {
      appointmentsList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 80 80" width="64" height="64"><circle cx="40" cy="40" r="30" fill="none" stroke="#cbd5e1" stroke-width="3"/><path d="M28 40 L36 48 L52 32" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h3>No appointments yet</h3>
          <p>Book your first appointment to get started.</p>
          <a href="#" class="btn btn-primary" data-nav="book">Book Now</a>
        </div>
      `;
      return;
    }

    if (list.length === 0) {
      appointmentsList.innerHTML = `
        <div class="empty-state">
          <h3>No ${tab} appointments</h3>
          <p>${tab === 'upcoming' ? 'You have no upcoming appointments.' : 'No past appointments found.'}</p>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(a => {
      const statusClass = a.status === 'confirmed' ? 'confirmed' : (a.status === 'completed' ? 'completed' : 'cancelled');
      html += `
        <div class="appt-card">
          <div class="appt-info">
            <h4>${a.treatment}</h4>
            <p>${formatDate(a.date)} at ${a.timeFormatted} &middot; ${a.doctor}</p>
          </div>
          <span class="appt-status ${statusClass}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
        </div>
      `;
    });
    appointmentsList.innerHTML = html;
  }

  // Appointment tabs
  apptTabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      apptTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentPatientTab = this.getAttribute('data-tab');
      renderAppointments();
    });
  });

  // ===== ADMIN DASHBOARD =====
  function renderDashboard() {
    const today = getDateStr(new Date());
    const allAppts = db.appointments;
    const todayAppts = allAppts.filter(a => a.date === today);
    const weekId = getWeekId(today);
    const weekAppts = allAppts.filter(a => getWeekId(a.date) === weekId);
    const patients = db.patients.length || new Set(allAppts.map(a => a.doctor)).size || 0;

    statToday.textContent = todayAppts.length;
    statWeek.textContent = weekAppts.length;
    statTotal.textContent = allAppts.length;
    statPatients.textContent = patients || Math.max(1, new Set(allAppts.map(a => a.doctor + a.date)).size);

    renderDashAppointments();
    renderSlotsManagement();
    renderPatientsList();
  }

  function renderDashAppointments() {
    const list = db.appointments;
    if (list.length === 0) {
      dashAppts.innerHTML = '<div class="empty-state"><p>No appointments scheduled.</p></div>';
      return;
    }
    let html = '';
    // Sort by date, most recent first
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || parseInt(a.time) - parseInt(b.time));
    sorted.forEach(a => {
      const statusClass = a.status === 'confirmed' ? 'confirmed' : (a.status === 'completed' ? 'completed' : 'cancelled');
      html += `
        <div class="appt-card">
          <div class="appt-info">
            <h4>${a.treatment}</h4>
            <p>${formatDate(a.date)} at ${a.timeFormatted} &middot; ${a.doctor}</p>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="appt-status ${statusClass}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
            <select class="status-change" data-id="${a.id}" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:.8rem;">
              <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>Confirm</option>
              <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Complete</option>
              <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
            </select>
          </div>
        </div>
      `;
    });
    dashAppts.innerHTML = html;

    // Bind status changes
    $$('.status-change').forEach(sel => {
      sel.addEventListener('change', function () {
        const id = parseInt(this.getAttribute('data-id'));
        const appt = db.appointments.find(a => a.id === id);
        if (appt) {
          appt.status = this.value;
          saveData(db);
          renderDashboard();
        }
      });
    });
  }

  function renderSlotsManagement() {
    // Show slots for a few days around current selection or today
    const today = new Date();
    let html = '<p style="margin-bottom:12px;font-size:.9rem;color:var(--text-light);">Toggle slots to block/unblock them for future dates.</p>';
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = getDateStr(d);
      const blocked = db.blockedSlots[dateStr] || [];
      const slots = ['8','9','10','11','13','14','15','16','17'];
      html += '<div style="margin-bottom:16px;">';
      html += '<strong style="font-size:.85rem;display:block;margin-bottom:6px;">' + formatDate(dateStr) + '</strong>';
      html += '<div class="slots-grid">';
      slots.forEach(h => {
        const isBlocked = blocked.indexOf(h) !== -1;
        html += '<button class="slot-btn ' + (isBlocked ? 'blocked' : '') + '" data-date="' + dateStr + '" data-hour="' + h + '">' + formatTime(parseInt(h)) + '</button>';
      });
      html += '</div></div>';
    }
    slotsGrid.innerHTML = html;

    $$('#slotsGrid .slot-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const date = this.getAttribute('data-date');
        const hour = this.getAttribute('data-hour');
        if (!db.blockedSlots[date]) db.blockedSlots[date] = [];
        const idx = db.blockedSlots[date].indexOf(hour);
        if (idx === -1) {
          db.blockedSlots[date].push(hour);
        } else {
          db.blockedSlots[date].splice(idx, 1);
        }
        saveData(db);
        renderSlotsManagement();
      });
    });
  }

  function renderPatientsList() {
    // Aggregate patient info from appointments
    const patientMap = {};
    db.appointments.forEach(a => {
      const key = a.doctor;
      if (!patientMap[key]) {
        patientMap[key] = { name: key, count: 0, treatments: [] };
      }
      patientMap[key].count++;
      if (patientMap[key].treatments.indexOf(a.treatment) === -1) {
        patientMap[key].treatments.push(a.treatment);
      }
    });

    // Also add explicit patients
    db.patients.forEach(p => {
      if (!patientMap[p.name]) {
        patientMap[p.name] = { name: p.name, count: p.visits || 0, treatments: [] };
      }
    });

    const entries = Object.values(patientMap);
    if (entries.length === 0) {
      patientsList.innerHTML = '<div class="empty-state"><p>No patient records yet.</p></div>';
      return;
    }

    let html = '';
    entries.forEach(p => {
      html += `
        <div class="patient-card">
          <div>
            <strong>${p.name}</strong>
            <span style="color:var(--text-light);font-size:.85rem;margin-left:8px;">${p.count} visit${p.count !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:.8rem;color:var(--text-muted);">${p.treatments.slice(0, 3).join(', ')}${p.treatments.length > 3 ? '...' : ''}</div>
        </div>
      `;
    });
    patientsList.innerHTML = html;
  }

  // Dashboard tabs
  dashTabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      dashTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const target = this.getAttribute('data-dtab');
      $$('.dash-panel').forEach(p => p.classList.remove('active'));
      const panel = $('#dash' + target.charAt(0).toUpperCase() + target.slice(1));
      if (panel) panel.classList.add('active');
      if (target === 'slots') renderSlotsManagement();
      if (target === 'patients') renderPatientsList();
    });
  });

  // ===== CONTACT FORM =====
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Thank you for your message! We will get back to you shortly.');
    this.reset();
  });

  // ===== INIT =====
  // Default: show home
  navigate('home');

  // Setup initial calendar state
  renderCalendar();

  // Seed some sample data for demo if completely empty
  if (db.appointments.length === 0 && db.patients.length === 0) {
    // Add a sample completed appointment so dashboard looks populated
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const yesterdayStr = getDateStr(yesterday);
    db.appointments.push({
      id: db.nextId++,
      treatment: 'Teeth Cleaning',
      doctor: 'Dr. Sarah Smith',
      date: yesterdayStr,
      time: '10',
      timeFormatted: '10:00 AM',
      notes: '',
      price: 80,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
    db.patients.push({ name: 'Dr. Sarah Smith', email: 'sarah@dentcare.com', visits: 5 });
    db.patients.push({ name: 'Dr. Michael Jones', email: 'michael@dentcare.com', visits: 3 });
    saveData(db);
  }

  console.log('DentCare — Your smile is our priority. App loaded successfully.');

})();
