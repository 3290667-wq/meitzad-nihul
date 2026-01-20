// Navigation Module for Meitzad Management System

const Navigation = {
  currentModule: 'dashboard',
  moduleTitles: {
    dashboard: 'לוח בקרה',
    budget: 'תקציב וכספים',
    planning: 'תכנון ובנייה',
    inquiries: 'פניות תושבים',
    meetings: 'ישיבות ופרוטוקולים',
    employees: 'ניהול עובדים',
    settings: 'הגדרות'
  },

  init() {
    this.setupEventListeners();
    this.handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleHashChange());
  },

  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar .nav-link[data-module]').forEach(link => {
      link.addEventListener('click', (e) => this.handleNavClick(e));
    });

    // Mobile bottom navigation
    document.querySelectorAll('.mobile-nav-item[data-module]').forEach(link => {
      link.addEventListener('click', (e) => this.handleNavClick(e));
    });

    // Mobile more menu items
    document.querySelectorAll('.more-menu-item[data-module]').forEach(link => {
      link.addEventListener('click', (e) => {
        this.handleNavClick(e);
        this.closeMobileMoreMenu();
      });
    });

    // Card action links (like "צפה בהכל")
    document.querySelectorAll('.card-action[data-module]').forEach(link => {
      link.addEventListener('click', (e) => this.handleNavClick(e));
    });

    // Mobile more button
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    if (mobileMoreBtn) {
      mobileMoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openMobileMoreMenu();
      });
    }

    // Close more menu
    const closeMoreMenu = document.getElementById('close-more-menu');
    const moreMenuOverlay = document.querySelector('.more-menu-overlay');

    if (closeMoreMenu) {
      closeMoreMenu.addEventListener('click', () => this.closeMobileMoreMenu());
    }
    if (moreMenuOverlay) {
      moreMenuOverlay.addEventListener('click', () => this.closeMobileMoreMenu());
    }

    // Sidebar toggle (collapse/expand)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Mobile menu button (opens sidebar on mobile if needed)
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => this.toggleMobileSidebar());
    }

    // Tab buttons within modules
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTabClick(e));
    });

    // Modal close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => Utils.closeModal());
    }
  },

  handleNavClick(e) {
    e.preventDefault();
    const module = e.currentTarget.dataset.module;
    if (module) {
      this.navigateTo(module);
    }
  },

  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.navigateTo(hash, false);
  },

  navigateTo(module, updateHash = true) {
    if (!this.moduleTitles[module]) {
      module = 'dashboard';
    }

    this.currentModule = module;

    // Update URL hash
    if (updateHash) {
      window.location.hash = module;
    }

    // Update page title
    const pageTitle = document.getElementById('current-page-title');
    if (pageTitle) {
      pageTitle.textContent = this.moduleTitles[module];
    }

    // Update document title
    document.title = `${this.moduleTitles[module]} | מערכת ניהול מיצד`;

    // Hide all modules
    document.querySelectorAll('.module').forEach(m => {
      m.classList.remove('active');
    });

    // Show target module
    const targetModule = document.getElementById(`module-${module}`);
    if (targetModule) {
      targetModule.classList.add('active');
    }

    // Update sidebar active state
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.module === module);
    });

    // Update mobile nav active state
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.module === module);
    });

    // Trigger module load/refresh
    this.onModuleChange(module);

    // Scroll to top
    window.scrollTo(0, 0);
  },

  onModuleChange(module) {
    // Call module-specific init/load functions
    switch (module) {
      case 'dashboard':
        if (typeof Dashboard !== 'undefined') Dashboard.load();
        break;
      case 'budget':
        if (typeof Budget !== 'undefined') Budget.load();
        break;
      case 'planning':
        if (typeof Planning !== 'undefined') Planning.load();
        break;
      case 'inquiries':
        if (typeof Inquiries !== 'undefined') Inquiries.load();
        break;
      case 'meetings':
        if (typeof Meetings !== 'undefined') Meetings.load();
        break;
      case 'employees':
        if (typeof Employees !== 'undefined') Employees.load();
        break;
      case 'settings':
        if (typeof Settings !== 'undefined') Settings.load();
        break;
    }
  },

  handleTabClick(e) {
    const button = e.currentTarget;
    const tabId = button.dataset.tab;

    // Get parent module to scope the tab change
    const moduleHeader = button.closest('.module-header');
    const module = button.closest('.module');

    if (!module) return;

    // Update active tab button
    moduleHeader.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn === button);
    });

    // Hide all tab contents within this module
    module.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Show target tab content
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');

    // Save preference
    Utils.setStorage('sidebar-collapsed', sidebar.classList.contains('collapsed'));
  },

  toggleMobileSidebar() {
    // For mobile, we might show a sidebar overlay or do nothing
    // since we use bottom navigation on mobile
    this.openMobileMoreMenu();
  },

  openMobileMoreMenu() {
    Utils.showElement('#mobile-more-menu', 'block');
    document.body.style.overflow = 'hidden';
  },

  closeMobileMoreMenu() {
    Utils.hideElement('#mobile-more-menu');
    document.body.style.overflow = '';
  },

  // Update badge counts
  updateInquiriesBadge(count) {
    const badges = [
      document.getElementById('inquiries-badge'),
      document.getElementById('mobile-inquiries-badge')
    ];

    badges.forEach(badge => {
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }
    });
  },

  updateNotificationDot(hasNotifications) {
    const dot = document.getElementById('notification-dot');
    if (dot) {
      dot.style.display = hasNotifications ? 'block' : 'none';
    }
  },

  // Restore sidebar state from storage
  restoreSidebarState() {
    const collapsed = Utils.getStorage('sidebar-collapsed', false);
    const sidebar = document.getElementById('sidebar');
    if (sidebar && collapsed) {
      sidebar.classList.add('collapsed');
    }
  }
};

// Initialize Navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Navigation.restoreSidebarState();
});

// Make Navigation globally available
window.Navigation = Navigation;
