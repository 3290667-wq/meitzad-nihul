// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let employees = [];
let currentEmployee = null;
let currentDepartment = 'all';

// Department translations
const DEPARTMENT_MAP = {
  management: 'הנהלה',
  maintenance: 'תחזוקה',
  security: 'ביטחון',
  education: 'חינוך',
  admin: 'מנהלה'
};

const STATUS_MAP = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  on_leave: 'בחופשה'
};

const TYPE_MAP = {
  full_time: 'משרה מלאה',
  part_time: 'משרה חלקית',
  contract: 'קבלן',
  volunteer: 'מתנדב'
};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// ==================== Authentication ====================

async function checkAuth() {
  if (!authToken) {
    window.location.href = '/#login';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;

      if (!['super_admin', 'admin'].includes(currentUser.role)) {
        showToast('אין לך הרשאת גישה לניהול עובדים', 'error');
        window.location.href = '/admin/dashboard.html';
        return;
      }

      document.getElementById('userName').textContent = `שלום, ${currentUser.name}`;
      loadEmployees();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    // For demo, load sample data
    loadSampleData();
  }
}

function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/#login';
}

// ==================== Data Loading ====================

async function loadEmployees() {
  try {
    const response = await fetch(`${API_BASE}/employees`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      employees = await response.json();
    } else {
      loadSampleData();
    }
  } catch (error) {
    console.error('Load employees error:', error);
    loadSampleData();
  }

  updateStats();
  renderEmployees();
}

function loadSampleData() {
  employees = [
    {
      id: 1,
      name: 'יוסי כהן',
      id_number: '123456789',
      position: 'מזכיר היישוב',
      department: 'management',
      phone: '050-1234567',
      email: 'yosi@meitzad.org.il',
      start_date: '2020-01-15',
      employment_type: 'full_time',
      salary: 15000,
      status: 'active',
      notes: ''
    },
    {
      id: 2,
      name: 'דוד לוי',
      id_number: '987654321',
      position: 'מנהל תחזוקה',
      department: 'maintenance',
      phone: '050-2345678',
      email: 'david@meitzad.org.il',
      start_date: '2019-06-01',
      employment_type: 'full_time',
      salary: 12000,
      status: 'active',
      notes: ''
    },
    {
      id: 3,
      name: 'משה אברהם',
      id_number: '456789123',
      position: 'קב"ט',
      department: 'security',
      phone: '050-3456789',
      email: 'moshe@meitzad.org.il',
      start_date: '2021-03-10',
      employment_type: 'full_time',
      salary: 14000,
      status: 'active',
      notes: ''
    },
    {
      id: 4,
      name: 'שרה ישראלי',
      id_number: '321654987',
      position: 'רכזת חינוך',
      department: 'education',
      phone: '050-4567890',
      email: 'sara@meitzad.org.il',
      start_date: '2022-09-01',
      employment_type: 'part_time',
      salary: 8000,
      status: 'active',
      notes: ''
    },
    {
      id: 5,
      name: 'רחל גולן',
      id_number: '654987321',
      position: 'מנהלת משרד',
      department: 'admin',
      phone: '050-5678901',
      email: 'rachel@meitzad.org.il',
      start_date: '2018-02-20',
      employment_type: 'full_time',
      salary: 10000,
      status: 'active',
      notes: ''
    },
    {
      id: 6,
      name: 'אבי מזרחי',
      id_number: '789321654',
      position: 'עובד תחזוקה',
      department: 'maintenance',
      phone: '050-6789012',
      email: 'avi@meitzad.org.il',
      start_date: '2023-01-05',
      employment_type: 'full_time',
      salary: 9000,
      status: 'active',
      notes: ''
    }
  ];

  updateStats();
  renderEmployees();
}

// ==================== Stats ====================

function updateStats() {
  const total = employees.length;
  const active = employees.filter(e => e.status === 'active').length;
  const departments = new Set(employees.map(e => e.department)).size;
  const totalSalary = employees.filter(e => e.status === 'active').reduce((sum, e) => sum + (e.salary || 0), 0);

  document.getElementById('totalEmployees').textContent = total;
  document.getElementById('activeEmployees').textContent = active;
  document.getElementById('totalDepartments').textContent = departments;
  document.getElementById('totalSalary').textContent = `₪${totalSalary.toLocaleString()}`;
}

// ==================== Rendering ====================

function renderEmployees() {
  const grid = document.getElementById('employeesGrid');
  let filtered = employees;

  if (currentDepartment !== 'all') {
    filtered = employees.filter(e => e.department === currentDepartment);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3>אין עובדים</h3>
        <p>לחץ על "עובד חדש" להוספת עובד ראשון</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(emp => `
    <div class="employee-card" onclick="viewEmployee(${emp.id})">
      <div class="employee-avatar">${getInitials(emp.name)}</div>
      <div class="employee-info">
        <h3 class="employee-name">${emp.name}</h3>
        <p class="employee-position">${emp.position}</p>
        <span class="employee-department">${DEPARTMENT_MAP[emp.department] || emp.department}</span>
      </div>
      <div class="employee-contact">
        ${emp.phone ? `<a href="tel:${emp.phone}" class="contact-link" onclick="event.stopPropagation()">📞 ${emp.phone}</a>` : ''}
        ${emp.email ? `<a href="mailto:${emp.email}" class="contact-link" onclick="event.stopPropagation()">📧</a>` : ''}
      </div>
      <div class="employee-status status-${emp.status}">${STATUS_MAP[emp.status]}</div>
      <div class="employee-actions">
        <button class="action-btn" onclick="event.stopPropagation(); editEmployee(${emp.id})" title="עריכה">✏️</button>
        <button class="action-btn" onclick="event.stopPropagation(); deleteEmployee(${emp.id})" title="מחיקה">🗑️</button>
      </div>
    </div>
  `).join('');
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('');
}

// ==================== Department Filter ====================

function filterByDepartment(department) {
  currentDepartment = department;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.department === department);
  });

  renderEmployees();
}

// ==================== Employee Actions ====================

function showAddEmployeeModal() {
  currentEmployee = null;
  document.getElementById('modalTitle').textContent = 'עובד חדש';
  document.getElementById('employeeForm').reset();
  document.getElementById('empStartDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('employeeModal').classList.remove('hidden');
}

function viewEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  currentEmployee = emp;
  document.getElementById('modalTitle').textContent = emp.name;

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="employee-view">
      <div class="employee-header">
        <div class="employee-avatar large">${getInitials(emp.name)}</div>
        <div>
          <h2>${emp.name}</h2>
          <p>${emp.position}</p>
        </div>
      </div>
      <div class="detail-group">
        <div class="detail-item">
          <label>תעודת זהות</label>
          <span>${emp.id_number}</span>
        </div>
        <div class="detail-item">
          <label>מחלקה</label>
          <span>${DEPARTMENT_MAP[emp.department] || emp.department}</span>
        </div>
        <div class="detail-item">
          <label>טלפון</label>
          <span>${emp.phone || '-'}</span>
        </div>
        <div class="detail-item">
          <label>אימייל</label>
          <span>${emp.email || '-'}</span>
        </div>
        <div class="detail-item">
          <label>תאריך התחלה</label>
          <span>${formatDate(emp.start_date)}</span>
        </div>
        <div class="detail-item">
          <label>סוג העסקה</label>
          <span>${TYPE_MAP[emp.employment_type] || emp.employment_type}</span>
        </div>
        <div class="detail-item">
          <label>שכר חודשי</label>
          <span>₪${(emp.salary || 0).toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <label>סטטוס</label>
          <span class="status-badge status-${emp.status}">${STATUS_MAP[emp.status]}</span>
        </div>
      </div>
      ${emp.notes ? `
        <div class="detail-item full">
          <label>הערות</label>
          <p>${emp.notes}</p>
        </div>
      ` : ''}
    </div>
  `;

  // Restore form for editing
  setTimeout(() => {
    modalBody.innerHTML = document.querySelector('#employeeModal .modal-body').innerHTML;
  }, 0);

  document.getElementById('employeeModal').classList.remove('hidden');
}

function editEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  currentEmployee = emp;
  document.getElementById('modalTitle').textContent = `עריכת ${emp.name}`;

  document.getElementById('empName').value = emp.name;
  document.getElementById('empIdNumber').value = emp.id_number;
  document.getElementById('empPosition').value = emp.position;
  document.getElementById('empDepartment').value = emp.department;
  document.getElementById('empPhone').value = emp.phone || '';
  document.getElementById('empEmail').value = emp.email || '';
  document.getElementById('empStartDate').value = emp.start_date;
  document.getElementById('empType').value = emp.employment_type;
  document.getElementById('empSalary').value = emp.salary || '';
  document.getElementById('empStatus').value = emp.status;
  document.getElementById('empNotes').value = emp.notes || '';

  document.getElementById('employeeModal').classList.remove('hidden');
}

async function saveEmployee() {
  const formData = {
    name: document.getElementById('empName').value,
    id_number: document.getElementById('empIdNumber').value,
    position: document.getElementById('empPosition').value,
    department: document.getElementById('empDepartment').value,
    phone: document.getElementById('empPhone').value,
    email: document.getElementById('empEmail').value,
    start_date: document.getElementById('empStartDate').value,
    employment_type: document.getElementById('empType').value,
    salary: parseFloat(document.getElementById('empSalary').value) || 0,
    status: document.getElementById('empStatus').value,
    notes: document.getElementById('empNotes').value
  };

  if (!formData.name || !formData.id_number || !formData.position || !formData.department) {
    showToast('נא למלא את כל השדות הנדרשים', 'error');
    return;
  }

  try {
    const url = currentEmployee ? `${API_BASE}/employees/${currentEmployee.id}` : `${API_BASE}/employees`;
    const method = currentEmployee ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      showToast(currentEmployee ? 'העובד עודכן בהצלחה' : 'העובד נוסף בהצלחה', 'success');
      closeModal();
      loadEmployees();
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    // For demo, update local data
    if (currentEmployee) {
      Object.assign(currentEmployee, formData);
    } else {
      formData.id = Math.max(...employees.map(e => e.id), 0) + 1;
      employees.push(formData);
    }
    showToast(currentEmployee ? 'העובד עודכן בהצלחה' : 'העובד נוסף בהצלחה', 'success');
    closeModal();
    updateStats();
    renderEmployees();
  }
}

async function deleteEmployee(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את העובד?')) return;

  try {
    const response = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('העובד נמחק בהצלחה', 'success');
      loadEmployees();
    } else {
      throw new Error('Delete failed');
    }
  } catch (error) {
    // For demo, update local data
    employees = employees.filter(e => e.id !== id);
    showToast('העובד נמחק בהצלחה', 'success');
    updateStats();
    renderEmployees();
  }
}

function closeModal() {
  document.getElementById('employeeModal').classList.add('hidden');
}

// ==================== Sidebar ====================

function toggleSidebar() {
  document.querySelector('.admin-sidebar').classList.toggle('open');
}

// ==================== Utilities ====================

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('he-IL');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// Global functions
window.showAddEmployeeModal = showAddEmployeeModal;
window.viewEmployee = viewEmployee;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.saveEmployee = saveEmployee;
window.closeModal = closeModal;
window.filterByDepartment = filterByDepartment;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
