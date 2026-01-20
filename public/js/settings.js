// Settings Module for Meitzad Management System

const Settings = {
  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', (e) => this.toggleTheme(e.target.checked));
    }

    // Notification toggles
    const notifToggles = document.querySelectorAll('.notification-toggle');
    notifToggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => this.updateNotificationSetting(e.target.name, e.target.checked));
    });

    // Save buttons
    document.querySelectorAll('.settings-save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = e.target.closest('.settings-card').dataset.section;
        this.saveSection(section);
      });
    });
  },

  async load() {
    Utils.showLoading();
    try {
      await Promise.all([
        this.loadSystemSettings(),
        this.loadUserSettings(),
        this.loadIntegrationSettings()
      ]);
    } catch (error) {
      console.error('Settings load error:', error);
      Utils.toast('שגיאה בטעינת הגדרות', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadSystemSettings() {
    try {
      const snapshot = await firebaseDB.ref('settings/system').once('value');
      const settings = snapshot.val() || {};

      // Populate form fields
      const settlementName = document.getElementById('settlement-name');
      const settlementEmail = document.getElementById('settlement-email');
      const settlementPhone = document.getElementById('settlement-phone');
      const settlementAddress = document.getElementById('settlement-address');

      if (settlementName) settlementName.value = settings.name || 'יישוב מיצד';
      if (settlementEmail) settlementEmail.value = settings.email || '';
      if (settlementPhone) settlementPhone.value = settings.phone || '';
      if (settlementAddress) settlementAddress.value = settings.address || '';

    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  },

  async loadUserSettings() {
    const uid = Auth.getUid();
    if (!uid) return;

    try {
      const snapshot = await firebaseDB.ref(`users/${uid}/settings`).once('value');
      const settings = snapshot.val() || {};

      // Theme
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.checked = settings.darkMode || false;
        if (settings.darkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      }

      // Notifications
      const notifInquiries = document.getElementById('notif-inquiries');
      const notifMeetings = document.getElementById('notif-meetings');
      const notifBudget = document.getElementById('notif-budget');
      const notifWhatsapp = document.getElementById('notif-whatsapp');

      if (notifInquiries) notifInquiries.checked = settings.notifications?.inquiries !== false;
      if (notifMeetings) notifMeetings.checked = settings.notifications?.meetings !== false;
      if (notifBudget) notifBudget.checked = settings.notifications?.budget !== false;
      if (notifWhatsapp) notifWhatsapp.checked = settings.notifications?.whatsapp !== false;

    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  },

  async loadIntegrationSettings() {
    try {
      const snapshot = await firebaseDB.ref('settings/integrations').once('value');
      const settings = snapshot.val() || {};

      // WhatsApp
      const whatsappEnabled = document.getElementById('whatsapp-enabled');
      const whatsappNumber = document.getElementById('whatsapp-number');

      if (whatsappEnabled) whatsappEnabled.checked = settings.whatsapp?.enabled || false;
      if (whatsappNumber) whatsappNumber.value = settings.whatsapp?.number || '';

      // Email
      const emailEnabled = document.getElementById('email-enabled');
      const emailAddress = document.getElementById('email-address');
      const emailSmtp = document.getElementById('email-smtp');

      if (emailEnabled) emailEnabled.checked = settings.email?.enabled || false;
      if (emailAddress) emailAddress.value = settings.email?.address || '';
      if (emailSmtp) emailSmtp.value = settings.email?.smtp || '';

      // Calendar
      const calendarEnabled = document.getElementById('calendar-enabled');
      const calendarId = document.getElementById('calendar-id');

      if (calendarEnabled) calendarEnabled.checked = settings.calendar?.enabled || false;
      if (calendarId) calendarId.value = settings.calendar?.id || '';

      // Transcription
      const transcriptionEnabled = document.getElementById('transcription-enabled');
      const transcriptionService = document.getElementById('transcription-service');

      if (transcriptionEnabled) transcriptionEnabled.checked = settings.transcription?.enabled || false;
      if (transcriptionService) transcriptionService.value = settings.transcription?.service || 'otter';

    } catch (error) {
      console.error('Error loading integration settings:', error);
    }
  },

  toggleTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    Utils.setLocal('theme', isDark ? 'dark' : 'light');

    // Save to user settings
    const uid = Auth.getUid();
    if (uid) {
      firebaseDB.ref(`users/${uid}/settings/darkMode`).set(isDark);
    }
  },

  async updateNotificationSetting(name, enabled) {
    const uid = Auth.getUid();
    if (!uid) return;

    try {
      await firebaseDB.ref(`users/${uid}/settings/notifications/${name}`).set(enabled);
    } catch (error) {
      console.error('Error updating notification setting:', error);
    }
  },

  async saveSection(section) {
    try {
      switch (section) {
        case 'system':
          await this.saveSystemSettings();
          break;
        case 'integrations':
          await this.saveIntegrationSettings();
          break;
        case 'users':
          await this.saveUserManagement();
          break;
        default:
          Utils.toast('שגיאה בשמירת ההגדרות', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Utils.toast('שגיאה בשמירת ההגדרות', 'error');
    }
  },

  async saveSystemSettings() {
    const data = {
      name: document.getElementById('settlement-name')?.value || '',
      email: document.getElementById('settlement-email')?.value || '',
      phone: document.getElementById('settlement-phone')?.value || '',
      address: document.getElementById('settlement-address')?.value || '',
      updatedAt: Date.now(),
      updatedBy: Auth.getUid()
    };

    await firebaseDB.ref('settings/system').update(data);
    Utils.toast('הגדרות המערכת נשמרו', 'success');
  },

  async saveIntegrationSettings() {
    const data = {
      whatsapp: {
        enabled: document.getElementById('whatsapp-enabled')?.checked || false,
        number: document.getElementById('whatsapp-number')?.value || ''
      },
      email: {
        enabled: document.getElementById('email-enabled')?.checked || false,
        address: document.getElementById('email-address')?.value || '',
        smtp: document.getElementById('email-smtp')?.value || ''
      },
      calendar: {
        enabled: document.getElementById('calendar-enabled')?.checked || false,
        id: document.getElementById('calendar-id')?.value || ''
      },
      transcription: {
        enabled: document.getElementById('transcription-enabled')?.checked || false,
        service: document.getElementById('transcription-service')?.value || 'otter'
      },
      updatedAt: Date.now(),
      updatedBy: Auth.getUid()
    };

    await firebaseDB.ref('settings/integrations').update(data);
    Utils.toast('הגדרות האינטגרציות נשמרו', 'success');
  },

  showAddUserModal(user = null) {
    const isEdit = !!user;

    const content = `
      <form id="user-form">
        <div class="form-group">
          <label for="user-email">אימייל *</label>
          <input type="email" id="user-email" name="email" required value="${user?.email || ''}" placeholder="user@meitzad.org.il" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label for="user-name">שם מלא *</label>
          <input type="text" id="user-name" name="name" required value="${user?.name || ''}" placeholder="ישראל ישראלי">
        </div>
        <div class="form-group">
          <label for="user-role">תפקיד</label>
          <select id="user-role" name="role">
            <option value="viewer" ${user?.role === 'viewer' ? 'selected' : ''}>צופה</option>
            <option value="editor" ${user?.role === 'editor' ? 'selected' : ''}>עורך</option>
            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>מנהל</option>
            <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>מנהל ראשי</option>
          </select>
        </div>
        ${!isEdit ? `
          <div class="form-group">
            <label for="user-password">סיסמה ראשונית *</label>
            <input type="password" id="user-password" name="password" required minlength="6" placeholder="לפחות 6 תווים">
          </div>
        ` : ''}
        <div class="form-group">
          <label for="user-phone">טלפון</label>
          <input type="tel" id="user-phone" name="phone" value="${user?.phone || ''}" placeholder="050-1234567">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      ${isEdit ? `<button class="btn btn-danger" onclick="Settings.deleteUser('${user.uid}')">מחק משתמש</button>` : ''}
      <button class="btn btn-primary" onclick="Settings.saveUser('${user?.uid || ''}')">${isEdit ? 'שמור שינויים' : 'צור משתמש'}</button>
    `;

    Utils.openModal(isEdit ? 'עריכת משתמש' : 'משתמש חדש', content, footer);
  },

  async saveUser(existingUid = '') {
    const form = document.getElementById('user-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const data = {
      email: formData.get('email'),
      name: formData.get('name'),
      role: formData.get('role'),
      phone: formData.get('phone'),
      updatedAt: Date.now(),
      updatedBy: Auth.getUid()
    };

    try {
      if (existingUid) {
        // Update existing user
        await firebaseDB.ref(`users/${existingUid}`).update(data);
        Utils.toast('המשתמש עודכן בהצלחה', 'success');
      } else {
        // Create new user - this requires Firebase Admin SDK or Cloud Functions
        // For now, just save user data and show instructions
        Utils.toast('יצירת משתמש חדש דורשת הגדרת Firebase Admin. פרטי המשתמש נשמרו.', 'warning');

        // Save user data for later activation
        const newUserRef = await firebaseDB.ref('pending_users').push({
          ...data,
          password: formData.get('password'),
          createdAt: Date.now(),
          createdBy: Auth.getUid()
        });
      }

      Utils.closeModal();
      this.loadUsers();

    } catch (error) {
      console.error('Error saving user:', error);
      Utils.toast('שגיאה בשמירת המשתמש', 'error');
    }
  },

  async loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    try {
      const snapshot = await firebaseDB.ref('users').once('value');
      const users = snapshot.val();

      if (!users) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state small">
              <span class="material-symbols-rounded">person_off</span>
              <p>אין משתמשים במערכת</p>
            </td>
          </tr>
        `;
        return;
      }

      const ROLE_NAMES = {
        super_admin: 'מנהל ראשי',
        admin: 'מנהל',
        editor: 'עורך',
        viewer: 'צופה'
      };

      tbody.innerHTML = Object.entries(users).map(([uid, user]) => `
        <tr>
          <td>${user.name || '-'}</td>
          <td>${user.email || '-'}</td>
          <td>${ROLE_NAMES[user.role] || user.role}</td>
          <td>
            <span class="status-badge status-${user.active !== false ? 'active' : 'inactive'}">
              ${user.active !== false ? 'פעיל' : 'לא פעיל'}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn" onclick="Settings.editUser('${uid}')" title="עריכה">
                <span class="material-symbols-rounded">edit</span>
              </button>
              ${user.role !== 'super_admin' ? `
                <button class="table-action-btn danger" onclick="Settings.deleteUser('${uid}')" title="מחיקה">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Error loading users:', error);
    }
  },

  async editUser(uid) {
    try {
      const snapshot = await firebaseDB.ref(`users/${uid}`).once('value');
      const user = snapshot.val();

      if (!user) {
        Utils.toast('המשתמש לא נמצא', 'error');
        return;
      }

      this.showAddUserModal({ uid, ...user });

    } catch (error) {
      console.error('Error loading user:', error);
      Utils.toast('שגיאה בטעינת פרטי המשתמש', 'error');
    }
  },

  async deleteUser(uid) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) return;

    try {
      // Soft delete - mark as inactive
      await firebaseDB.ref(`users/${uid}`).update({
        active: false,
        deletedAt: Date.now(),
        deletedBy: Auth.getUid()
      });

      Utils.toast('המשתמש נמחק בהצלחה', 'success');
      Utils.closeModal();
      this.loadUsers();

    } catch (error) {
      console.error('Error deleting user:', error);
      Utils.toast('שגיאה במחיקת המשתמש', 'error');
    }
  },

  async resetUserPassword(uid) {
    try {
      const snapshot = await firebaseDB.ref(`users/${uid}/email`).once('value');
      const email = snapshot.val();

      if (!email) {
        Utils.toast('לא נמצא אימייל למשתמש', 'error');
        return;
      }

      await firebaseAuth.sendPasswordResetEmail(email);
      Utils.toast('נשלח מייל לאיפוס סיסמה', 'success');

    } catch (error) {
      console.error('Error resetting password:', error);
      Utils.toast('שגיאה בשליחת מייל איפוס', 'error');
    }
  },

  async exportData() {
    Utils.toast('מייצא נתונים...', 'info');

    try {
      // Get all data
      const [inquiries, meetings, employees, transactions, projects] = await Promise.all([
        firebaseDB.ref('inquiries').once('value'),
        firebaseDB.ref('meetings').once('value'),
        firebaseDB.ref('employees').once('value'),
        firebaseDB.ref('transactions').once('value'),
        firebaseDB.ref('projects').once('value')
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        inquiries: inquiries.val() || {},
        meetings: meetings.val() || {},
        employees: employees.val() || {},
        transactions: transactions.val() || {},
        projects: projects.val() || {}
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meitzad_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Utils.toast('הנתונים יוצאו בהצלחה', 'success');

    } catch (error) {
      console.error('Error exporting data:', error);
      Utils.toast('שגיאה בייצוא הנתונים', 'error');
    }
  },

  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!confirm('האם אתה בטוח שברצונך לייבא את הנתונים? פעולה זו תחליף נתונים קיימים.')) {
          return;
        }

        Utils.toast('מייבא נתונים...', 'info');

        // Import each collection
        const updates = {};
        if (data.inquiries) updates['inquiries'] = data.inquiries;
        if (data.meetings) updates['meetings'] = data.meetings;
        if (data.employees) updates['employees'] = data.employees;
        if (data.transactions) updates['transactions'] = data.transactions;
        if (data.projects) updates['projects'] = data.projects;

        await firebaseDB.ref().update(updates);

        Utils.toast('הנתונים יובאו בהצלחה', 'success');

      } catch (error) {
        console.error('Error importing data:', error);
        Utils.toast('שגיאה בייבוא הנתונים', 'error');
      }
    };

    input.click();
  },

  cleanup() {}
};

window.Settings = Settings;
