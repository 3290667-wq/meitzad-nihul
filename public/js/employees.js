// Employees Module for Meitzad Management System
// Uses API instead of Firebase

const Employees = {
  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addBtn = document.getElementById('add-employee-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddEmployeeModal());
    }

    // Department filter
    const deptFilter = document.getElementById('employee-department-filter');
    if (deptFilter) {
      deptFilter.addEventListener('change', (e) => this.loadEmployees(e.target.value));
    }
  },

  async load() {
    Utils.showLoading();
    try {
      await Promise.all([
        this.loadEmployees(),
        this.loadAttendance(),
        this.loadPayrollSummary()
      ]);
    } catch (error) {
      console.error('Employees load error:', error);
      Utils.toast('שגיאה בטעינת עובדים', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // Department translations
  DEPARTMENTS: {
    management: 'הנהלה',
    maintenance: 'תחזוקה',
    security: 'ביטחון',
    education: 'חינוך',
    admin: 'מנהלה',
    other: 'אחר'
  },

  // Status translations
  STATUSES: {
    active: 'פעיל',
    inactive: 'לא פעיל',
    on_leave: 'בחופשה'
  },

  // Employment types
  EMPLOYMENT_TYPES: {
    full_time: 'משרה מלאה',
    part_time: 'משרה חלקית',
    contract: 'קבלן',
    volunteer: 'מתנדב'
  },

  async loadEmployees(department = 'all') {
    const grid = document.getElementById('employees-grid');
    if (!grid) return;

    try {
      const params = new URLSearchParams();
      if (department && department !== 'all') {
        params.append('department', department);
      }

      const employees = await API.get(`/api/employees?${params.toString()}`);

      if (!employees || employees.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">group_off</span>
            <p>אין עובדים במערכת</p>
          </div>
        `;
        return;
      }

      // Sort by name
      employees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

      grid.innerHTML = employees.map(employee => this.renderEmployeeCard(employee)).join('');

      // Update stats
      this.updateStats(employees);

    } catch (error) {
      console.error('Error loading employees:', error);
    }
  },

  renderEmployeeCard(employee) {
    const initials = this.getInitials(employee.name);
    const dept = this.DEPARTMENTS[employee.department] || employee.department;
    const status = this.STATUSES[employee.status] || employee.status;

    return `
      <div class="employee-card" onclick="Employees.viewEmployee('${employee.id}')">
        <div class="employee-card-header">
          <div class="employee-avatar">
            ${employee.photo ? `<img src="${employee.photo}" alt="${employee.name}">` : `<span>${initials}</span>`}
          </div>
          <div class="employee-info">
            <h4 class="employee-name">${employee.name}</h4>
            <p class="employee-position">${employee.position || ''}</p>
            <span class="employee-department">${dept}</span>
          </div>
        </div>
        <div class="employee-card-body">
          <div class="employee-contact">
            ${employee.phone ? `
              <a href="tel:${employee.phone}" class="contact-link" onclick="event.stopPropagation()">
                <span class="material-symbols-rounded">phone</span>
                ${employee.phone}
              </a>
            ` : ''}
          </div>
        </div>
        <div class="employee-card-footer">
          <span class="status-badge status-${employee.status}">${status}</span>
          <div class="employee-actions">
            <button class="table-action-btn" onclick="event.stopPropagation(); Employees.sendWhatsApp('${employee.phone}')" title="שלח ווצאפ">
              <span class="material-symbols-rounded">chat</span>
            </button>
            <button class="table-action-btn" onclick="event.stopPropagation(); Employees.editEmployee('${employee.id}')" title="עריכה">
              <span class="material-symbols-rounded">edit</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('');
  },

  updateStats(employees) {
    const total = employees.length;
    const active = employees.filter(e => e.status === 'active').length;
    const departments = new Set(employees.map(e => e.department)).size;
    const totalSalary = employees
      .filter(e => e.status === 'active')
      .reduce((sum, e) => sum + (e.salary || 0), 0);

    const totalEl = document.getElementById('total-employees');
    const activeEl = document.getElementById('active-employees');
    const deptEl = document.getElementById('total-departments');
    const salaryEl = document.getElementById('total-salary');

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (deptEl) deptEl.textContent = departments;
    if (salaryEl) salaryEl.textContent = Utils.formatCurrency(totalSalary);
  },

  async loadAttendance() {
    const tbody = document.getElementById('attendance-body');
    if (!tbody) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      const data = await API.get(`/api/employees/attendance/date/${today}`);

      const attendanceMap = {};
      if (data.attendance) {
        data.attendance.forEach(record => {
          attendanceMap[record.employee_id] = record;
        });
      }

      const employees = data.employees || [];

      // Render attendance table
      const rows = employees.map(emp => {
        const record = attendanceMap[emp.id];
        const status = record ? (record.check_out ? 'completed' : 'present') : 'absent';
        const statusText = record ? (record.check_out ? 'סיים' : 'נוכח') : 'לא הגיע';

        return `
          <tr>
            <td>${emp.name}</td>
            <td>${record?.check_in ? Utils.formatTime(new Date(record.check_in).getTime()) : '-'}</td>
            <td>${record?.check_out ? Utils.formatTime(new Date(record.check_out).getTime()) : '-'}</td>
            <td>
              <span class="status-badge status-${status}">${statusText}</span>
            </td>
            <td>
              <div class="table-actions">
                ${!record ? `
                  <button class="table-action-btn" onclick="Employees.recordCheckIn('${emp.id}')" title="רישום כניסה">
                    <span class="material-symbols-rounded">login</span>
                  </button>
                ` : !record.check_out ? `
                  <button class="table-action-btn" onclick="Employees.recordCheckOut('${emp.id}')" title="רישום יציאה">
                    <span class="material-symbols-rounded">logout</span>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (rows) {
        tbody.innerHTML = rows;
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state small">
              <span class="material-symbols-rounded">event_busy</span>
              <p>אין עובדים פעילים</p>
            </td>
          </tr>
        `;
      }

      // Update attendance summary
      const present = Object.keys(attendanceMap).length;
      const absent = employees.length - present;

      const presentEl = document.getElementById('present-count');
      const absentEl = document.getElementById('absent-count');

      if (presentEl) presentEl.textContent = present;
      if (absentEl) absentEl.textContent = absent;

    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  },

  async recordCheckIn(employeeId) {
    try {
      await API.post('/api/employees/attendance/check-in', { employee_id: employeeId });
      Utils.toast('כניסה נרשמה בהצלחה', 'success');
      this.loadAttendance();
    } catch (error) {
      console.error('Error recording check-in:', error);
      Utils.toast('שגיאה ברישום כניסה', 'error');
    }
  },

  async recordCheckOut(employeeId) {
    try {
      await API.post('/api/employees/attendance/check-out', { employee_id: employeeId });
      Utils.toast('יציאה נרשמה בהצלחה', 'success');
      this.loadAttendance();
    } catch (error) {
      console.error('Error recording check-out:', error);
      Utils.toast('שגיאה ברישום יציאה', 'error');
    }
  },

  async loadPayrollSummary() {
    const container = document.getElementById('payroll-summary-container');
    if (!container) return;

    try {
      const payroll = await API.get('/api/employees/payroll/summary');

      const employees = payroll.employees || [];
      const totalSalary = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
      const socialCosts = totalSalary * 0.185; // 18.5% for social benefits
      const totalCost = totalSalary + socialCosts;

      container.innerHTML = `
        <div class="payroll-summary-cards">
          <div class="summary-card">
            <div class="summary-icon income">
              <span class="material-symbols-rounded">payments</span>
            </div>
            <div class="summary-details">
              <span class="summary-label">סה"כ שכר ברוטו</span>
              <span class="summary-value">${Utils.formatCurrency(totalSalary)}</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-icon expense">
              <span class="material-symbols-rounded">account_balance</span>
            </div>
            <div class="summary-details">
              <span class="summary-label">עלויות סוציאליות</span>
              <span class="summary-value">${Utils.formatCurrency(socialCosts)}</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-icon total">
              <span class="material-symbols-rounded">calculate</span>
            </div>
            <div class="summary-details">
              <span class="summary-label">עלות מעביד כוללת</span>
              <span class="summary-value">${Utils.formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>
        <p class="payroll-note">* חישוב משוער. העלויות הסוציאליות כוללות הפרשות לפנסיה, ביטוח לאומי והבראה.</p>
      `;

    } catch (error) {
      console.error('Error loading payroll summary:', error);
    }
  },

  showAddEmployeeModal(employee = null) {
    const isEdit = !!employee;

    const content = `
      <form id="employee-form">
        <div class="form-row">
          <div class="form-group">
            <label for="emp-name">שם מלא *</label>
            <input type="text" id="emp-name" name="name" required value="${employee?.name || ''}" placeholder="ישראל ישראלי">
          </div>
          <div class="form-group">
            <label for="emp-id-number">תעודת זהות</label>
            <input type="text" id="emp-id-number" name="id_number" value="${employee?.id_number || ''}" placeholder="123456789">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="emp-position">תפקיד *</label>
            <input type="text" id="emp-position" name="position" required value="${employee?.position || ''}" placeholder="מנהל תחזוקה">
          </div>
          <div class="form-group">
            <label for="emp-department">מחלקה *</label>
            <select id="emp-department" name="department" required>
              <option value="">בחר מחלקה</option>
              <option value="management" ${employee?.department === 'management' ? 'selected' : ''}>הנהלה</option>
              <option value="maintenance" ${employee?.department === 'maintenance' ? 'selected' : ''}>תחזוקה</option>
              <option value="security" ${employee?.department === 'security' ? 'selected' : ''}>ביטחון</option>
              <option value="education" ${employee?.department === 'education' ? 'selected' : ''}>חינוך</option>
              <option value="admin" ${employee?.department === 'admin' ? 'selected' : ''}>מנהלה</option>
              <option value="other" ${employee?.department === 'other' ? 'selected' : ''}>אחר</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="emp-phone">טלפון</label>
            <input type="tel" id="emp-phone" name="phone" value="${employee?.phone || ''}" placeholder="050-1234567">
          </div>
          <div class="form-group">
            <label for="emp-email">אימייל</label>
            <input type="email" id="emp-email" name="email" value="${employee?.email || ''}" placeholder="israel@meitzad.org.il">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="emp-start-date">תאריך התחלה</label>
            <input type="date" id="emp-start-date" name="start_date" value="${employee?.start_date || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="emp-type">סוג העסקה</label>
            <select id="emp-type" name="employment_type">
              <option value="full_time" ${employee?.employment_type === 'full_time' ? 'selected' : ''}>משרה מלאה</option>
              <option value="part_time" ${employee?.employment_type === 'part_time' ? 'selected' : ''}>משרה חלקית</option>
              <option value="contract" ${employee?.employment_type === 'contract' ? 'selected' : ''}>קבלן</option>
              <option value="volunteer" ${employee?.employment_type === 'volunteer' ? 'selected' : ''}>מתנדב</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="emp-salary">שכר חודשי (₪)</label>
            <input type="number" id="emp-salary" name="salary" value="${employee?.salary || ''}" placeholder="10000">
          </div>
          <div class="form-group">
            <label for="emp-status">סטטוס</label>
            <select id="emp-status" name="status">
              <option value="active" ${employee?.status === 'active' ? 'selected' : ''}>פעיל</option>
              <option value="on_leave" ${employee?.status === 'on_leave' ? 'selected' : ''}>בחופשה</option>
              <option value="inactive" ${employee?.status === 'inactive' ? 'selected' : ''}>לא פעיל</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="emp-attendance-notifications" name="send_attendance_notifications" ${employee?.send_attendance_notifications ? 'checked' : ''}>
            <span class="toggle-switch"></span>
            שלח התראות נוכחות בווצאפ
          </label>
        </div>
        <div class="form-group">
          <label for="emp-notes">הערות</label>
          <textarea id="emp-notes" name="notes" rows="3" placeholder="הערות נוספות...">${employee?.notes || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      <button class="btn btn-primary" onclick="Employees.saveEmployee('${employee?.id || ''}')">${isEdit ? 'שמור שינויים' : 'הוסף עובד'}</button>
    `;

    Utils.openModal(isEdit ? 'עריכת עובד' : 'עובד חדש', content, footer);
  },

  async saveEmployee(existingId = '') {
    const form = document.getElementById('employee-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      id_number: formData.get('id_number'),
      position: formData.get('position'),
      department: formData.get('department'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      start_date: formData.get('start_date'),
      employment_type: formData.get('employment_type'),
      salary: parseFloat(formData.get('salary')) || 0,
      status: formData.get('status'),
      send_attendance_notifications: form.querySelector('#emp-attendance-notifications').checked,
      notes: formData.get('notes')
    };

    try {
      if (existingId) {
        await API.put(`/api/employees/${existingId}`, data);
        Utils.toast('העובד עודכן בהצלחה', 'success');
      } else {
        await API.post('/api/employees', data);
        Utils.toast('העובד נוסף בהצלחה', 'success');
      }

      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error saving employee:', error);
      Utils.toast(error.message || 'שגיאה בשמירת העובד', 'error');
    }
  },

  async viewEmployee(id) {
    try {
      const employee = await API.get(`/api/employees/${id}`);

      if (!employee) {
        Utils.toast('העובד לא נמצא', 'error');
        return;
      }

      const dept = this.DEPARTMENTS[employee.department] || employee.department;
      const status = this.STATUSES[employee.status] || employee.status;
      const empType = this.EMPLOYMENT_TYPES[employee.employment_type] || employee.employment_type;
      const initials = this.getInitials(employee.name);

      const content = `
        <div class="employee-detail">
          <div class="employee-detail-header">
            <div class="employee-avatar large">
              ${employee.photo ? `<img src="${employee.photo}" alt="${employee.name}">` : `<span>${initials}</span>`}
            </div>
            <div class="employee-detail-info">
              <h2>${employee.name}</h2>
              <p>${employee.position}</p>
              <span class="status-badge status-${employee.status}">${status}</span>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="material-symbols-rounded">badge</span>
              <div>
                <label>תעודת זהות</label>
                <span>${employee.id_number || '-'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">business</span>
              <div>
                <label>מחלקה</label>
                <span>${dept}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">phone</span>
              <div>
                <label>טלפון</label>
                <span>${employee.phone || '-'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">mail</span>
              <div>
                <label>אימייל</label>
                <span>${employee.email || '-'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">event</span>
              <div>
                <label>תאריך התחלה</label>
                <span>${employee.start_date ? Utils.formatDate(new Date(employee.start_date).getTime()) : '-'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">work</span>
              <div>
                <label>סוג העסקה</label>
                <span>${empType}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">payments</span>
              <div>
                <label>שכר חודשי</label>
                <span>${Utils.formatCurrency(employee.salary || 0)}</span>
              </div>
            </div>
          </div>

          ${employee.notes ? `
            <div class="detail-notes">
              <label>הערות</label>
              <p>${employee.notes}</p>
            </div>
          ` : ''}
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">סגור</button>
        ${employee.phone ? `<button class="btn btn-outline" onclick="Employees.sendWhatsApp('${employee.phone}')"><span class="material-symbols-rounded">chat</span> ווצאפ</button>` : ''}
        <button class="btn btn-primary" onclick="Employees.editEmployee('${id}')"><span class="material-symbols-rounded">edit</span> עריכה</button>
      `;

      Utils.openModal(employee.name, content, footer);

    } catch (error) {
      console.error('Error viewing employee:', error);
      Utils.toast('שגיאה בטעינת פרטי העובד', 'error');
    }
  },

  async editEmployee(id) {
    try {
      const employee = await API.get(`/api/employees/${id}`);

      if (!employee) {
        Utils.toast('העובד לא נמצא', 'error');
        return;
      }

      Utils.closeModal();
      setTimeout(() => {
        this.showAddEmployeeModal({ id, ...employee });
      }, 300);

    } catch (error) {
      console.error('Error editing employee:', error);
      Utils.toast('שגיאה בטעינת פרטי העובד', 'error');
    }
  },

  async deleteEmployee(id) {
    Utils.confirm(
      'מחיקת עובד',
      'האם אתה בטוח שברצונך למחוק את העובד?',
      async () => {
        try {
          await API.delete(`/api/employees/${id}`);
          Utils.toast('העובד נמחק בהצלחה', 'success');
          Utils.closeModal();
          this.load();
        } catch (error) {
          console.error('Error deleting employee:', error);
          Utils.toast('שגיאה במחיקת העובד', 'error');
        }
      }
    );
  },

  sendWhatsApp(phone) {
    if (!phone) {
      Utils.toast('אין מספר טלפון', 'error');
      return;
    }
    Utils.sendWhatsAppMessage(phone, '');
  },

  cleanup() {}
};

window.Employees = Employees;
