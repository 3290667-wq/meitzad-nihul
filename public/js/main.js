// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadCategories();
  checkAuth();
  initForms();
  handleHashChange();
});

// ==================== Navigation ====================

function initNavigation() {
  // Handle nav links
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });

  // Handle hash changes
  window.addEventListener('hashchange', handleHashChange);

  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.querySelector('.main-nav');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });
  }
}

function handleHashChange() {
  const hash = window.location.hash.slice(1) || 'home';
  navigateTo(hash);
}

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });

  // Update URL hash
  if (page !== 'home') {
    window.location.hash = page;
  } else {
    history.replaceState(null, null, ' ');
  }

  // Close mobile menu
  document.querySelector('.main-nav')?.classList.remove('open');
}

// ==================== Authentication ====================

async function checkAuth() {
  if (!authToken) {
    updateUIForGuest();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      updateUIForUser();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    logout();
  }
}

function updateUIForGuest() {
  currentUser = null;
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.textContent = 'התחברות';
    loginBtn.setAttribute('data-page', 'login');
    loginBtn.href = '#login';
  }
}

function updateUIForUser() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.textContent = currentUser.name;
    loginBtn.setAttribute('data-page', 'dashboard');
    loginBtn.href = '#dashboard';

    // If admin, redirect to admin dashboard
    if (['super_admin', 'admin', 'staff'].includes(currentUser.role)) {
      loginBtn.href = '/admin/dashboard.html';
      loginBtn.removeAttribute('data-page');
    }
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  updateUIForGuest();
  navigateTo('home');
}

// ==================== Forms ====================

function initForms() {
  // Request form
  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', handleRequestSubmit);
  }

  // Track form
  const trackForm = document.getElementById('trackForm');
  if (trackForm) {
    trackForm.addEventListener('submit', handleTrackSubmit);
  }

  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

// Handle request submission
async function handleRequestSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      // Show success
      form.classList.add('hidden');
      const successDiv = document.getElementById('submitSuccess');
      document.getElementById('requestNumber').textContent = result.request.requestNumber;
      successDiv.classList.remove('hidden');
      showToast('הפנייה נשלחה בהצלחה!', 'success');
    } else {
      showToast(result.error || 'שגיאה בשליחת הפנייה', 'error');
    }
  } catch (error) {
    console.error('Submit error:', error);
    showToast('שגיאה בשליחת הפנייה', 'error');
  }
}

// Handle track submission
async function handleTrackSubmit(e) {
  e.preventDefault();

  const trackNumber = document.getElementById('trackNumber').value.trim();
  const resultDiv = document.getElementById('trackResult');

  try {
    const response = await fetch(`${API_BASE}/requests/track/${trackNumber}`);
    const result = await response.json();

    if (response.ok) {
      displayTrackResult(result);
      resultDiv.classList.remove('hidden');
    } else {
      resultDiv.innerHTML = `<p class="error-text">פנייה מספר ${trackNumber} לא נמצאה</p>`;
      resultDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Track error:', error);
    showToast('שגיאה בחיפוש הפנייה', 'error');
  }
}

function displayTrackResult(request) {
  const statusMap = {
    new: 'חדש',
    in_progress: 'בטיפול',
    pending: 'ממתין',
    resolved: 'נפתר',
    closed: 'סגור'
  };

  const priorityMap = {
    low: 'נמוכה',
    normal: 'רגילה',
    high: 'גבוהה',
    urgent: 'דחופה'
  };

  const resultDiv = document.getElementById('trackResult');
  resultDiv.innerHTML = `
    <h4>פנייה מספר ${request.requestNumber}</h4>
    <div class="track-info">
      <div class="track-info-item">
        <label>נושא</label>
        <span>${request.subject}</span>
      </div>
      <div class="track-info-item">
        <label>קטגוריה</label>
        <span>${request.category}</span>
      </div>
      <div class="track-info-item">
        <label>סטטוס</label>
        <span class="status-badge status-${request.status}">${statusMap[request.status]}</span>
      </div>
      <div class="track-info-item">
        <label>דחיפות</label>
        <span>${priorityMap[request.priority]}</span>
      </div>
      <div class="track-info-item">
        <label>תאריך הגשה</label>
        <span>${formatDate(request.createdAt)}</span>
      </div>
      <div class="track-info-item">
        <label>עדכון אחרון</label>
        <span>${formatDate(request.updatedAt)}</span>
      </div>
      ${request.resolvedAt ? `
        <div class="track-info-item">
          <label>נפתר בתאריך</label>
          <span>${formatDate(request.resolvedAt)}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (response.ok) {
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem('authToken', authToken);
      updateUIForUser();
      showToast('התחברת בהצלחה!', 'success');

      // Redirect
      if (['super_admin', 'admin', 'staff'].includes(currentUser.role)) {
        window.location.href = '/admin/dashboard.html';
      } else {
        navigateTo('home');
      }
    } else {
      showToast(result.error || 'שגיאה בהתחברות', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('שגיאה בהתחברות', 'error');
  }
}

// Handle registration
async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const address = document.getElementById('regAddress').value;
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showToast('הסיסמאות לא תואמות', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, address, password })
    });

    const result = await response.json();

    if (response.ok) {
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem('authToken', authToken);
      updateUIForUser();
      showToast('נרשמת בהצלחה!', 'success');
      navigateTo('home');
    } else {
      showToast(result.error || 'שגיאה בהרשמה', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showToast('שגיאה בהרשמה', 'error');
  }
}

// ==================== Categories ====================

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/requests/categories`);
    const categories = await response.json();

    // Populate select dropdown
    const select = document.getElementById('categoryId');
    if (select) {
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon} ${cat.name_he}`;
        select.appendChild(option);
      });
    }

    // Populate categories grid
    const grid = document.getElementById('categoriesGrid');
    if (grid) {
      grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="selectCategory(${cat.id})">
          <div class="category-icon">${cat.icon}</div>
          <h4>${cat.name_he}</h4>
          <p>${cat.description || ''}</p>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Load categories error:', error);
  }
}

function selectCategory(categoryId) {
  navigateTo('submit');
  setTimeout(() => {
    const select = document.getElementById('categoryId');
    if (select) {
      select.value = categoryId;
    }
  }, 100);
}

// ==================== Utilities ====================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Make functions available globally
window.selectCategory = selectCategory;
window.logout = logout;
