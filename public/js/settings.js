// Settings Module for Meitzad Management System
// Uses API instead of Firebase

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
        this.loadUserSettings()
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
      const settings = await API.get('/api/settings');

      // Populate form fields
      const settlementName = document.getElementById('settlement-name');
      const settlementEmail = document.getElementById('settlement-email');
      const settlementPhone = document.getElementById('settlement-phone');
      const settlementAddress = document.getElementById('settlement-address');

      if (settlementName) settlementName.value = settings.site_name || 'יישוב מיצד';
      if (settlementEmail) settlementEmail.value = settings.site_email || '';
      if (settlementPhone) settlementPhone.value = settings.site_phone || '';
      if (settlementAddress) settlementAddress.value = settings.site_address || '';

    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  },

  async loadUserSettings() {
    try {
      const prefs = await API.get('/api/settings/user/preferences');

      // Theme
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.checked = prefs.darkMode || false;
        if (prefs.darkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      }

      // Notifications
      const notifInquiries = document.getElementById('notif-inquiries');
      const notifMeetings = document.getElementById('notif-meetings');
      const notifBudget = document.getElementById('notif-budget');

      if (notifInquiries) notifInquiries.checked = prefs.notifications?.inquiries !== false;
      if (notifMeetings) notifMeetings.checked = prefs.notifications?.meetings !== false;
      if (notifBudget) notifBudget.checked = prefs.notifications?.budget !== false;

    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  },

  toggleTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    Utils.setStorage('theme', isDark ? 'dark' : 'light');

    // Save to user preferences
    API.put('/api/settings/user/preferences', { darkMode: isDark }).catch(console.error);
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
      site_name: document.getElementById('settlement-name')?.value || '',
      site_email: document.getElementById('settlement-email')?.value || '',
      site_phone: document.getElementById('settlement-phone')?.value || '',
      site_address: document.getElementById('settlement-address')?.value || ''
    };

    await API.post('/api/settings/bulk', data);
    Utils.toast('הגדרות המערכת נשמרו', 'success');
  },

  async saveIntegrationSettings() {
    const data = {
      whatsapp_enabled: document.getElementById('whatsapp-enabled')?.checked || false,
      whatsapp_number: document.getElementById('whatsapp-number')?.value || '',
      email_enabled: document.getElementById('email-enabled')?.checked || false,
      email_address: document.getElementById('email-address')?.value || ''
    };

    await API.post('/api/settings/bulk', data);
    Utils.toast('הגדרות האינטגרציות נשמרו', 'success');
  },

  async exportData() {
    Utils.toast('מייצא נתונים...', 'info');

    try {
      const data = await API.get('/api/settings/export');

      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

  cleanup() {}
};

window.Settings = Settings;
