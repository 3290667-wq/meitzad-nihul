// Authentication Module for Meitzad Management System
// Uses Backend API (not Firebase)

const Auth = {
  currentUser: null,
  userData: null,
  token: null,

  // Initialize auth state from localStorage
  init() {
    // Check for saved token
    this.token = localStorage.getItem('meitzad_token');
    const savedUser = localStorage.getItem('meitzad_user');

    if (this.token && savedUser) {
      try {
        this.userData = JSON.parse(savedUser);
        this.currentUser = this.userData;
        this.verifyToken();
      } catch (e) {
        this.clearAuth();
        this.onAuthFailure();
      }
    } else {
      this.onAuthFailure();
    }

    this.setupEventListeners();
  },

  // Verify token is still valid
  async verifyToken() {
    try {
      const response = await this.apiRequest('/api/auth/me');
      if (response.user) {
        this.userData = response.user;
        this.currentUser = response.user;
        this.saveUserLocally();
        this.onAuthSuccess();
      } else {
        this.clearAuth();
        this.onAuthFailure();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      this.clearAuth();
      this.onAuthFailure();
    }
  },

  // Make authenticated API request
  async apiRequest(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'שגיאה בשרת');
    }

    return data;
  },

  // Setup login form and other auth event listeners
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Password visibility toggle
    const togglePassword = document.querySelector('.toggle-password');
    if (togglePassword) {
      togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
    }

    // Forgot password link
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => this.handleForgotPassword(e));
    }

    // Logout buttons
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', () => this.logout());
    }
  },

  // Handle login form submission
  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me')?.checked;

    if (!email || !password) {
      Utils.toast('אנא מלאו את כל השדות', 'error');
      return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
      const response = await this.apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      // Save token and user data
      this.token = response.token;
      this.userData = response.user;
      this.currentUser = response.user;

      // Save to localStorage
      localStorage.setItem('meitzad_token', this.token);
      this.saveUserLocally();

      Utils.toast('התחברת בהצלחה!', 'success');
      this.onAuthSuccess();

    } catch (error) {
      console.error('Login error:', error);
      Utils.toast(error.message || 'שגיאה בהתחברות. נסו שוב.', 'error');
    } finally {
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      submitBtn.disabled = false;
    }
  },

  // Toggle password visibility
  togglePasswordVisibility() {
    const passwordInput = document.getElementById('login-password');
    const toggleBtn = document.querySelector('.toggle-password .material-symbols-rounded');

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = 'visibility_off';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = 'visibility';
    }
  },

  // Handle forgot password
  async handleForgotPassword(e) {
    e.preventDefault();

    const content = `
      <form id="forgot-password-form" class="settings-form">
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">
          הזינו את כתובת האימייל שלכם ונשלח לכם קישור לאיפוס הסיסמה.
        </p>
        <div class="form-group">
          <label for="reset-email">כתובת אימייל</label>
          <input type="email" id="reset-email" name="email" required placeholder="your@email.com">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      <button class="btn btn-primary" id="send-reset-btn">שלח קישור איפוס</button>
    `;

    Utils.openModal('איפוס סיסמה', content, footer);

    // Handle form submission
    document.getElementById('send-reset-btn').addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();

      if (!email) {
        Utils.toast('נא להזין כתובת אימייל', 'error');
        return;
      }

      if (!Utils.isValidEmail(email)) {
        Utils.toast('כתובת אימייל לא תקינה', 'error');
        return;
      }

      const btn = document.getElementById('send-reset-btn');
      btn.disabled = true;
      btn.textContent = 'שולח...';

      try {
        await this.apiRequest('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });

        Utils.closeModal();
        Utils.toast('אם האימייל קיים במערכת, נשלח אליך קישור לאיפוס סיסמה', 'success', 6000);
      } catch (error) {
        console.error('Forgot password error:', error);
        Utils.toast(error.message || 'שגיאה בשליחת הבקשה', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'שלח קישור איפוס';
      }
    });
  },

  // Save user data locally
  saveUserLocally() {
    if (this.userData) {
      localStorage.setItem('meitzad_user', JSON.stringify(this.userData));
    }
  },

  // Clear auth data
  clearAuth() {
    this.token = null;
    this.userData = null;
    this.currentUser = null;
    localStorage.removeItem('meitzad_token');
    localStorage.removeItem('meitzad_user');
  },

  // Called when authentication is successful
  onAuthSuccess() {
    // Hide login screen, show main app
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');

    loginScreen.classList.remove('active');
    mainScreen.classList.add('active');

    // Update user info in sidebar
    this.updateUserUI();

    // Initialize the app
    if (typeof App !== 'undefined' && App.init) {
      App.init();
    }
  },

  // Called when user is not authenticated
  onAuthFailure() {
    // Show login screen, hide main app
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');

    mainScreen.classList.remove('active');
    loginScreen.classList.add('active');

    // Clear login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
  },

  // Update user info in the UI
  updateUserUI() {
    if (!this.userData) return;

    const userName = document.getElementById('sidebar-user-name');
    const userRole = document.getElementById('sidebar-user-role');

    if (userName) userName.textContent = this.userData.name || 'משתמש';
    if (userRole) userRole.textContent = this.getRoleLabel(this.userData.role);
  },

  // Get Hebrew role label
  getRoleLabel(role) {
    const labels = {
      super_admin: 'מנהל ראשי',
      admin: 'מנהל',
      staff: 'צוות',
      citizen: 'תושב',
      user: 'משתמש'
    };
    return labels[role] || role;
  },

  // Logout
  logout() {
    Utils.confirm(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      () => {
        this.clearAuth();
        Utils.toast('התנתקת בהצלחה', 'success');
        // Close mobile menu if open
        Utils.hideElement('#mobile-more-menu');
        this.onAuthFailure();
      },
      'התנתק',
      'ביטול'
    );
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser && !!this.token;
  },

  // Check if user has specific role
  hasRole(role) {
    if (!this.userData) return false;
    if (this.userData.role === 'super_admin' || this.userData.role === 'admin') return true;
    return this.userData.role === role;
  },

  // Check if user is admin
  isAdmin() {
    return this.hasRole('admin') || this.hasRole('super_admin');
  },

  // Get current user ID
  getUid() {
    return this.currentUser ? this.currentUser.id : null;
  },

  // Get auth token for API requests
  getToken() {
    return this.token;
  },

  // Update user profile
  async updateProfile(data) {
    if (!this.currentUser) return false;

    try {
      const response = await this.apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      this.userData = { ...this.userData, ...response.user };
      this.currentUser = this.userData;
      this.saveUserLocally();
      this.updateUserUI();

      Utils.toast('הפרטים עודכנו בהצלחה', 'success');
      return true;
    } catch (error) {
      console.error('Update profile error:', error);
      Utils.toast(error.message || 'שגיאה בעדכון הפרטים', 'error');
      return false;
    }
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    if (!this.currentUser) return false;

    try {
      await this.apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      Utils.toast('הסיסמה עודכנה בהצלחה', 'success');
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      Utils.toast(error.message || 'שגיאה בעדכון הסיסמה', 'error');
      return false;
    }
  }
};

// Initialize Auth module
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});

// Make Auth globally available
window.Auth = Auth;
