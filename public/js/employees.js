// Employees Module for Meitzad Management System

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
    admin: 'מנהלה'
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
      const snapshot = await firebaseDB.ref('employees')
        .orderByChild('name')
        .once('value');

      const employees = snapshot.val();

      if (!employees) {
        grid.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">group_off</span>
            <p>אין עובדים במערכת</p>
          </div>
        `;
        return;
      }

      let employeesArray = Object.entries(employees)
        .map(([id, data]) => ({ id, ...data }))
        .filter(e => e.status !== 'deleted');

      // Filter by department if specified
      if (department !== 'all') {
        employeesArray = employeesArray.filter(e => e.department === department);
      }

      // Sort by name
      employeesArray.sort((a, b) => a.name.localeCompare(b.name, 'he'));

      grid.innerHTML = employeesArray.map(employee => this.renderEmployeeCard(employee)).join('');

      // Update stats
      this.updateStats(Object.values(employees).filter(e => e.status !== 'deleted'));

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    try {
      // Get today's attendance records
      const snapshot = await firebaseDB.ref('attendance')
        .orderByChild('date')
        .equalTo(todayStr)
        .once('value');

      const attendance = snapshot.val();

      // Get all active employees
      const empSnapshot = await firebaseDB.ref('employees')
        .orderByChild('status')
        .equalTo('active')
        .once('value');

      const employees = empSnapshot.val() || {};

      const attendanceMap = {};
      if (attendance) {
        Object.values(attendance).forEach(record => {
          attendanceMap[record.employeeId] = record;
        });
      }

      // Render attendance table
      const rows = Object.entries(employees).map(([empId, emp]) => {
        const record = attendanceMap[empId];
        const status = record ? (record.checkOut ? 'completed' : 'present') : 'absent';
        const statusText = record ? (record.checkOut ? 'סיים' : 'נוכח') : 'לא הגיע';

        return `
          <tr>
            <td>${emp.name}</td>
            <td>${record?.checkIn ? Utils.formatTime(new Date(record.checkIn).getTime()) : '-'}</td>
            <td>${record?.checkOut ? Utils.formatTime(new Date(record.checkOut).getTime()) : '-'}</td>
            <td>
              <span class="status-badge status-${status}">${statusText}</span>
            </td>
            <td>
              <div class="table-actions">
                ${!record ? `
                  <button class="table-action-btn" onclick="Employees.recordCheckIn('${empId}')" title="רישום כניסה">
                    <span class="material-symbols-rounded">login</span>
                  </button>
                ` : !record.checkOut ? `
                  <button class="table-action-btn" onclick="Employees.recordCheckOut('${empId}')" title="רישום יציאה">
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
      const present = Object.values(attendanceMap).length;
      const absent = Object.keys(employees).length - present;

      const presentEl = document.getElementById('present-count');
      const absentEl = document.getElementById('absent-count');

      if (presentEl) presentEl.textContent = present;
      if (absentEl) absentEl.textContent = absent;

    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  },

  async recordCheckIn(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      await firebaseDB.ref('attendance').push({
        employeeId,
        date: today,
        checkIn: now,
        createdBy: Auth.getUid()
      });

      Utils.toast('כניסה נרשמה בהצלחה', 'success');
      this.loadAttendance();

      // Send WhatsApp notification if configured
      const empSnapshot = await firebaseDB.ref(`employees/${employeeId}`).once('value');
      const emp = empSnapshot.val();
      if (emp?.phone && emp?.sendAttendanceNotifications) {
        Utils.sendWhatsApp(emp.phone, `שלום ${emp.name}, כניסתך לעבודה נרשמה בשעה ${Utils.formatTime(Date.now())}`);
      }

    } catch (error) {
      console.error('Error recording check-in:', error);
      Utils.toast('שגיאה ברישום כניסה', 'error');
    }
  },

  async recordCheckOut(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      // Find today's attendance record for this employee
      const snapshot = await firebaseDB.ref('attendance')
        .orderByChild('employeeId')
        .equalTo(employeeId)
        .once('value');

      const records = snapshot.val();
      if (!records) {
        Utils.toast('לא נמצא רישום כניסה להיום', 'error');
        return;
      }

      // Find today's record
      const todayRecord = Object.entries(records).find(([id, r]) => r.date === today && !r.checkOut);

      if (!todayRecord) {
        Utils.toast('לא נמצא רישום כניסה להיום', 'error');
        return;
      }

      await firebaseDB.ref(`attendance/${todayRecord[0]}`).update({
        checkOut: now,
        updatedBy: Auth.getUid()
      });

      Utils.toast('יציאה נרשמה בהצלחה', 'success');
      this.loadAttendance();

      // Send WhatsApp notification if configured
      const empSnapshot = await firebaseDB.ref(`employees/${employeeId}`).once('value');
      const emp = empSnapshot.val();
      if (emp?.phone && emp?.sendAttendanceNotifications) {
        Utils.sendWhatsApp(emp.phone, `שלום ${emp.name}, יציאתך מהעבודה נרשמה בשעה ${Utils.formatTime(Date.now())}`);
      }

    } catch (error) {
      console.error('Error recording check-out:', error);
      Utils.toast('שגיאה ברישום יציאה', 'error');
    }
  },

  async loadPayrollSummary() {
    const container = document.getElementById('payroll-summary-container');
    if (!container) return;

    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Get all active employees
      const empSnapshot = await firebaseDB.ref('employees')
        .orderByChild('status')
        .equalTo('active')
        .once('value');

      const employees = empSnapshot.val() || {};
      const employeesArray = Object.values(employees);

      const totalSalary = employeesArray.reduce((sum, e) => sum + (e.salary || 0), 0);
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
            <label for="emp-id-number">תעודת זהות *</label>
            <input type="text" id="emp-id-number" name="id_number" required value="${employee?.id_number || ''}" placeholder="123456789">
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
            <input type="checkbox" id="emp-attendance-notifications" name="sendAttendanceNotifications" ${employee?.sendAttendanceNotifications ? 'checked' : ''}>
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
      sendAttendanceNotifications: form.querySelector('#emp-attendance-notifications').checked,
      notes: formData.get('notes'),
      updatedAt: Date.now(),
      updatedBy: Auth.getUid()
    };

    if (!existingId) {
      data.createdAt = Date.now();
      data.createdBy = Auth.getUid();
    }

    try {
      if (existingId) {
        await firebaseDB.ref(`employees/${existingId}`).update(data);
        Utils.toast('העובד עודכן בהצלחה', 'success');
      } else {
        await firebaseDB.ref('employees').push(data);
        Utils.toast('העובד נוסף בהצלחה', 'success');
      }

      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error saving employee:', error);
      Utils.toast('שגיאה בשמירת העובד', 'error');
    }
  },

  async viewEmployee(id) {
    try {
      const snapshot = await firebaseDB.ref(`employees/${id}`).once('value');
      const employee = snapshot.val();

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
      const snapshot = await firebaseDB.ref(`employees/${id}`).once('value');
      const employee = snapshot.val();

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
    if (!confirm('האם אתה בטוח שברצונך למחוק את העובד?')) return;

    try {
      // Soft delete - just mark as deleted
      await firebaseDB.ref(`employees/${id}`).update({
        status: 'deleted',
        deletedAt: Date.now(),
        deletedBy: Auth.getUid()
      });

      Utils.toast('העובד נמחק בהצלחה', 'success');
      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error deleting employee:', error);
      Utils.toast('שגיאה במחיקת העובד', 'error');
    }
  },

  sendWhatsApp(phone) {
    if (!phone) {
      Utils.toast('אין מספר טלפון', 'error');
      return;
    }
    Utils.sendWhatsApp(phone, '');
  },

  async generatePayrollReport() {
    Utils.toast('מפיק דו"ח משכורות...', 'info');

    try {
      const snapshot = await firebaseDB.ref('employees')
        .orderByChild('status')
        .equalTo('active')
        .once('value');

      const employees = snapshot.val();
      if (!employees) {
        Utils.toast('אין עובדים פעילים', 'warning');
        return;
      }

      const data = Object.values(employees).map(emp => ({
        'שם': emp.name,
        'תפקיד': emp.position,
        'מחלקה': this.DEPARTMENTS[emp.department] || emp.department,
        'סוג העסקה': this.EMPLOYMENT_TYPES[emp.employment_type] || emp.employment_type,
        'שכר ברוטו': emp.salary || 0,
        'עלות מעביד': Math.round((emp.salary || 0) * 1.185)
      }));

      const month = Utils.getHebrewMonth(new Date().getMonth());
      const year = new Date().getFullYear();

      Utils.exportToCSV(data, `משכורות_${month}_${year}`);
      Utils.toast('הדו"ח הורד בהצלחה', 'success');

    } catch (error) {
      console.error('Error generating payroll report:', error);
      Utils.toast('שגיאה בהפקת הדו"ח', 'error');
    }
  },

  async generateAttendanceReport() {
    Utils.toast('מפיק דו"ח נוכחות...', 'info');

    try {
      const month = new Date().getMonth();
      const year = new Date().getFullYear();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const snapshot = await firebaseDB.ref('attendance')
        .orderByChild('date')
        .startAt(startDate)
        .endAt(endDate)
        .once('value');

      const attendance = snapshot.val();

      if (!attendance) {
        Utils.toast('אין נתוני נוכחות לחודש זה', 'warning');
        return;
      }

      // Get employee names
      const empSnapshot = await firebaseDB.ref('employees').once('value');
      const employees = empSnapshot.val() || {};

      const data = Object.values(attendance).map(record => ({
        'שם': employees[record.employeeId]?.name || 'לא ידוע',
        'תאריך': record.date,
        'כניסה': record.checkIn ? Utils.formatTime(new Date(record.checkIn).getTime()) : '-',
        'יציאה': record.checkOut ? Utils.formatTime(new Date(record.checkOut).getTime()) : '-',
        'שעות': record.checkIn && record.checkOut ?
          Math.round((new Date(record.checkOut) - new Date(record.checkIn)) / 3600000 * 10) / 10 : 0
      }));

      const monthName = Utils.getHebrewMonth(month);
      Utils.exportToCSV(data, `נוכחות_${monthName}_${year}`);
      Utils.toast('הדו"ח הורד בהצלחה', 'success');

    } catch (error) {
      console.error('Error generating attendance report:', error);
      Utils.toast('שגיאה בהפקת הדו"ח', 'error');
    }
  },

  cleanup() {}
};

window.Employees = Employees;
