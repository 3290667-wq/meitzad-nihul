// Authentication Module for Meitzad Management System

const Auth = {
  currentUser: null,
  userData: null,

  // Initialize auth state listener
  init() {
    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserData(user.uid);
        this.onAuthSuccess();
      } else {
        this.currentUser = null;
        this.userData = null;
        this.onAuthFailure();
      }
    });

    this.setupEventListeners();
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
      // Set persistence based on remember me
      const persistence = rememberMe
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;

      await firebaseAuth.setPersistence(persistence);
      await firebaseAuth.signInWithEmailAndPassword(email, password);

      Utils.toast('התחברת בהצלחה!', 'success');

    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'שגיאה בהתחברות. נסו שוב.';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'משתמש לא נמצא במערכת';
          break;
        case 'auth/wrong-password':
          errorMessage = 'סיסמה שגויה';
          break;
        case 'auth/invalid-email':
          errorMessage = 'כתובת אימייל לא תקינה';
          break;
        case 'auth/user-disabled':
          errorMessage = 'חשבון זה הושבת';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.';
          break;
      }

      Utils.toast(errorMessage, 'error');

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

    const email = document.getElementById('login-email').value.trim();

    if (!email) {
      Utils.toast('אנא הזינו כתובת אימייל', 'warning');
      return;
    }

    if (!Utils.isValidEmail(email)) {
      Utils.toast('כתובת אימייל לא תקינה', 'error');
      return;
    }

    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      Utils.toast('נשלח אימייל לאיפוס סיסמה', 'success');
    } catch (error) {
      console.error('Password reset error:', error);

      if (error.code === 'auth/user-not-found') {
        Utils.toast('משתמש עם אימייל זה לא נמצא', 'error');
      } else {
        Utils.toast('שגיאה בשליחת אימייל. נסו שוב.', 'error');
      }
    }
  },

  // Load user data from database
  async loadUserData(uid) {
    try {
      const snapshot = await firebaseDB.ref(`users/${uid}`).once('value');
      this.userData = snapshot.val();

      if (!this.userData) {
        // Create basic user record if doesn't exist
        this.userData = {
          email: this.currentUser.email,
          name: this.currentUser.displayName || 'משתמש',
          role: 'admin',
          createdAt: Date.now()
        };
        await firebaseDB.ref(`users/${uid}`).set(this.userData);
      }

      // Update last login
      await firebaseDB.ref(`users/${uid}/lastLogin`).set(Date.now());

    } catch (error) {
      console.error('Error loading user data:', error);
    }
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
      user: 'משתמש'
    };
    return labels[role] || role;
  },

  // Logout
  async logout() {
    Utils.confirm(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      async () => {
        try {
          await firebaseAuth.signOut();
          Utils.toast('התנתקת בהצלחה', 'success');
          // Close mobile menu if open
          Utils.hideElement('#mobile-more-menu');
        } catch (error) {
          console.error('Logout error:', error);
          Utils.toast('שגיאה בהתנתקות', 'error');
        }
      },
      'התנתק',
      'ביטול'
    );
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  },

  // Check if user has specific role
  hasRole(role) {
    if (!this.userData) return false;
    if (this.userData.role === 'super_admin') return true;
    return this.userData.role === role;
  },

  // Check if user is admin
  isAdmin() {
    return this.hasRole('admin') || this.hasRole('super_admin');
  },

  // Get current user UID
  getUid() {
    return this.currentUser ? this.currentUser.uid : null;
  },

  // Update user profile
  async updateProfile(data) {
    if (!this.currentUser) return false;

    try {
      await firebaseDB.ref(`users/${this.currentUser.uid}`).update({
        ...data,
        updatedAt: Date.now()
      });

      // Reload user data
      await this.loadUserData(this.currentUser.uid);
      this.updateUserUI();

      Utils.toast('הפרטים עודכנו בהצלחה', 'success');
      return true;
    } catch (error) {
      console.error('Update profile error:', error);
      Utils.toast('שגיאה בעדכון הפרטים', 'error');
      return false;
    }
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    if (!this.currentUser) return false;

    try {
      // Re-authenticate user
      const credential = firebase.auth.EmailAuthProvider.credential(
        this.currentUser.email,
        currentPassword
      );
      await this.currentUser.reauthenticateWithCredential(credential);

      // Update password
      await this.currentUser.updatePassword(newPassword);

      Utils.toast('הסיסמה עודכנה בהצלחה', 'success');
      return true;
    } catch (error) {
      console.error('Change password error:', error);

      if (error.code === 'auth/wrong-password') {
        Utils.toast('סיסמה נוכחית שגויה', 'error');
      } else {
        Utils.toast('שגיאה בעדכון הסיסמה', 'error');
      }
      return false;
    }
  },

  // Create new user (admin only)
  async createUser(email, password, userData) {
    if (!this.isAdmin()) {
      Utils.toast('אין לך הרשאה לפעולה זו', 'error');
      return null;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // Save user data to database
      await firebaseDB.ref(`users/${uid}`).set({
        ...userData,
        email,
        createdAt: Date.now(),
        createdBy: this.currentUser.uid
      });

      Utils.toast('משתמש נוצר בהצלחה', 'success');
      return uid;
    } catch (error) {
      console.error('Create user error:', error);

      if (error.code === 'auth/email-already-in-use') {
        Utils.toast('כתובת האימייל כבר בשימוש', 'error');
      } else {
        Utils.toast('שגיאה ביצירת המשתמש', 'error');
      }
      return null;
    }
  }
};

// Initialize Auth module
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});

// Make Auth globally available
window.Auth = Auth;
