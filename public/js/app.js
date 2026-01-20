// Main Application for Meitzad Management System
// Initializes all modules and handles app lifecycle

const App = {
  // App state
  initialized: false,
  currentModule: null,

  // Module registry
  modules: {
    dashboard: Dashboard,
    budget: Budget,
    planning: Planning,
    inquiries: Inquiries,
    meetings: Meetings,
    employees: Employees,
    settings: Settings
  },

  // Initialize the application
  async init() {
    if (this.initialized) return;

    console.log('Initializing Meitzad Management System...');

    try {
      // Initialize utilities first
      Utils.init();

      // Check for saved theme
      const savedTheme = Utils.getLocal('theme');
      if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      // Initialize authentication
      Auth.init();

      // Wait for auth state to be determined
      await this.waitForAuth();

      // Initialize navigation
      Navigation.init();

      // Initialize all modules
      this.initModules();

      // Setup global event listeners
      this.setupGlobalListeners();

      // Handle initial route
      this.handleInitialRoute();

      this.initialized = true;
      console.log('Meitzad Management System initialized successfully');

    } catch (error) {
      console.error('Failed to initialize application:', error);
      Utils.toast('שגיאה באתחול המערכת', 'error');
    }
  },

  // Wait for auth state (no Firebase dependency)
  waitForAuth() {
    return new Promise((resolve) => {
      // Check if user is already authenticated via token
      const token = localStorage.getItem('meitzad_token');
      if (token) {
        resolve({ token });
      } else {
        resolve(null);
      }
    });
  },

  // Initialize all registered modules
  initModules() {
    Object.entries(this.modules).forEach(([name, module]) => {
      if (module && typeof module.init === 'function') {
        try {
          module.init();
          console.log(`Module "${name}" initialized`);
        } catch (error) {
          console.error(`Failed to initialize module "${name}":`, error);
        }
      }
    });
  },

  // Setup global event listeners
  setupGlobalListeners() {
    // Handle hash changes for navigation
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (hash && this.modules[hash]) {
        this.loadModule(hash);
      }
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.onAppFocus();
      }
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.hideOfflineBanner();
      Utils.toast('חזרת לרשת', 'success');
      this.refreshCurrentModule();
    });

    window.addEventListener('offline', () => {
      this.showOfflineBanner();
    });

    // Check initial online status
    if (!navigator.onLine) {
      this.showOfflineBanner();
    }

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcut(e);
    });

    // Prevent accidental navigation away
    window.addEventListener('beforeunload', (e) => {
      // Check if there are unsaved changes
      if (this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  // Handle initial route based on URL hash
  handleInitialRoute() {
    const hash = window.location.hash.slice(1);
    if (hash && this.modules[hash]) {
      // Let Navigation handle the loading
      Navigation.navigateTo(hash);
    } else {
      // Default to dashboard
      Navigation.navigateTo('dashboard');
    }
  },

  // Load a specific module
  async loadModule(moduleName) {
    const module = this.modules[moduleName];
    if (!module) {
      console.warn(`Module "${moduleName}" not found`);
      return;
    }

    // Cleanup previous module
    if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
      this.currentModule.cleanup();
    }

    // Load new module
    this.currentModule = module;

    if (typeof module.load === 'function') {
      try {
        await module.load();
      } catch (error) {
        console.error(`Error loading module "${moduleName}":`, error);
        Utils.toast('שגיאה בטעינת המודול', 'error');
      }
    }
  },

  // Called when app regains focus
  onAppFocus() {
    // Refresh data if needed
    if (this.currentModule && typeof this.currentModule.refresh === 'function') {
      this.currentModule.refresh();
    }
  },

  // Refresh current module data
  refreshCurrentModule() {
    if (this.currentModule && typeof this.currentModule.load === 'function') {
      this.currentModule.load();
    }
  },

  // Handle keyboard shortcuts
  handleKeyboardShortcut(e) {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl/Cmd + key shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          // Open quick search (future feature)
          e.preventDefault();
          // this.openQuickSearch();
          break;
        case 'b':
          // Toggle sidebar
          e.preventDefault();
          Navigation.toggleSidebar();
          break;
      }
    }

    // Number keys for quick navigation (without modifiers)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const moduleMap = {
        '1': 'dashboard',
        '2': 'budget',
        '3': 'planning',
        '4': 'inquiries',
        '5': 'meetings',
        '6': 'employees'
      };

      if (moduleMap[e.key]) {
        e.preventDefault();
        Navigation.navigateTo(moduleMap[e.key]);
      }
    }
  },

  // Check for unsaved changes
  hasUnsavedChanges() {
    // Check if any form has been modified
    const forms = document.querySelectorAll('form[data-modified="true"]');
    return forms.length > 0;
  },

  // Mark form as modified
  markFormModified(formId, modified = true) {
    const form = document.getElementById(formId);
    if (form) {
      form.dataset.modified = modified.toString();
    }
  },

  // Get app version
  getVersion() {
    return '1.0.0';
  },

  // Get app info
  getInfo() {
    return {
      name: 'מערכת ניהול יישוב מיצד',
      version: this.getVersion(),
      buildDate: '2026-01-20',
      developer: 'Meitzad Development Team'
    };
  },

  // Show offline banner
  showOfflineBanner() {
    // Check if banner already exists
    if (document.getElementById('offline-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.innerHTML = `
      <span class="material-symbols-rounded">wifi_off</span>
      <span>אין חיבור לאינטרנט - חלק מהפעולות לא יהיו זמינות</span>
    `;
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--color-warning, #f59e0b);
      color: white;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Adjust main content
    const mainScreen = document.getElementById('main-screen');
    if (mainScreen) {
      mainScreen.style.marginTop = '40px';
    }
  },

  // Hide offline banner
  hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.remove();
    }

    // Reset main content margin
    const mainScreen = document.getElementById('main-screen');
    if (mainScreen) {
      mainScreen.style.marginTop = '';
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Expose to window for debugging
window.App = App;
