// Utility Functions for Meitzad Management System

const Utils = {
  // ===== Date & Time Formatting =====
  formatDate(date, format = 'short') {
    const d = new Date(date);
    const options = {
      short: { day: 'numeric', month: 'numeric', year: '2-digit' },
      medium: { day: 'numeric', month: 'short', year: 'numeric' },
      long: { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' },
      time: { hour: '2-digit', minute: '2-digit' },
      full: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    return d.toLocaleDateString('he-IL', options[format] || options.short);
  },

  formatTime(date) {
    return new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  },

  formatRelativeTime(date) {
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    if (days < 7) return `לפני ${days} ימים`;
    return this.formatDate(date, 'short');
  },

  // Get Hebrew month name
  getHebrewMonth(monthIndex) {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                   'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    return months[monthIndex];
  },

  // Get Hebrew day name
  getHebrewDay(dayIndex) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[dayIndex];
  },

  // ===== Number & Currency Formatting =====
  formatCurrency(amount, showSign = false) {
    const formatted = new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));

    if (showSign && amount !== 0) {
      return amount > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  },

  formatNumber(num) {
    return new Intl.NumberFormat('he-IL').format(num);
  },

  formatPercent(value, decimals = 0) {
    return `${value.toFixed(decimals)}%`;
  },

  // ===== String Utilities =====
  truncate(str, length = 100) {
    if (!str || str.length <= length) return str;
    return str.slice(0, length) + '...';
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  slugify(str) {
    return str
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u0590-\u05FF-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  // Generate unique ID
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
  },

  // Generate inquiry number (format: M2026-0001)
  generateInquiryNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `M${year}-${random}`;
  },

  // ===== Validation =====
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  isValidPhone(phone) {
    const re = /^0\d{1,2}-?\d{7}$/;
    return re.test(phone.replace(/[\s-]/g, ''));
  },

  isValidIsraeliId(id) {
    id = String(id).trim();
    if (id.length > 9 || isNaN(id)) return false;
    id = id.padStart(9, '0');
    return Array.from(id, Number)
      .reduce((sum, digit, i) => {
        const step = digit * ((i % 2) + 1);
        return sum + (step > 9 ? step - 9 : step);
      }, 0) % 10 === 0;
  },

  // ===== DOM Utilities =====
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  createElement(tag, className, innerHTML = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  // Show/hide element with animation
  showElement(element, display = 'block') {
    if (typeof element === 'string') element = this.$(element);
    if (!element) return;
    element.classList.remove('hidden');
    element.style.display = display;
  },

  hideElement(element) {
    if (typeof element === 'string') element = this.$(element);
    if (!element) return;
    element.classList.add('hidden');
  },

  toggleElement(element) {
    if (typeof element === 'string') element = this.$(element);
    if (!element) return;
    element.classList.toggle('hidden');
  },

  // ===== Toast Notifications =====
  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const toast = this.createElement('div', `toast ${type}`, `
      <div class="toast-icon">
        <span class="material-symbols-rounded">${icons[type]}</span>
      </div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">
        <span class="material-symbols-rounded">close</span>
      </button>
    `);

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.removeToast(toast));

    setTimeout(() => this.removeToast(toast), duration);

    return toast;
  },

  removeToast(toast) {
    if (!toast) return;
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  },

  // ===== Loading State =====
  showLoading() {
    this.showElement('#loading-overlay', 'flex');
  },

  hideLoading() {
    this.hideElement('#loading-overlay');
  },

  // ===== Modal Utilities =====
  openModal(title, content, footer = '') {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modalFooter.innerHTML = footer;

    this.showElement(overlay, 'flex');

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    // Close on ESC key
    document.addEventListener('keydown', this.handleModalEsc);
  },

  closeModal() {
    this.hideElement('#modal-overlay');
    document.removeEventListener('keydown', this.handleModalEsc);
  },

  handleModalEsc(e) {
    if (e.key === 'Escape') Utils.closeModal();
  },

  // Confirm dialog
  confirm(title, message, onConfirm, confirmText = 'אישור', cancelText = 'ביטול') {
    const content = `<p style="color: var(--color-text-secondary);">${message}</p>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">${cancelText}</button>
      <button class="btn btn-danger" id="confirm-action-btn">${confirmText}</button>
    `;

    this.openModal(title, content, footer);

    document.getElementById('confirm-action-btn').addEventListener('click', () => {
      this.closeModal();
      if (onConfirm) onConfirm();
    });
  },

  // ===== Local Storage =====
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  },

  getStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('LocalStorage error:', e);
      return defaultValue;
    }
  },

  removeStorage(key) {
    localStorage.removeItem(key);
  },

  // ===== Debounce & Throttle =====
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // ===== File Utilities =====
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  },

  // ===== URL & Query Params =====
  getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },

  setQueryParam(name, value) {
    const url = new URL(window.location);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
  },

  // ===== Category & Status Labels =====
  getCategoryLabel(category) {
    const labels = {
      infrastructure: 'תשתיות',
      security: 'ביטחון',
      environment: 'סביבה',
      education: 'חינוך',
      welfare: 'רווחה',
      maintenance: 'תחזוקה',
      financial: 'כספים',
      other: 'אחר'
    };
    return labels[category] || category;
  },

  getStatusLabel(status) {
    const labels = {
      new: 'חדש',
      open: 'פתוח',
      'in-progress': 'בטיפול',
      pending: 'ממתין',
      resolved: 'טופל',
      closed: 'סגור',
      completed: 'הושלם',
      cancelled: 'בוטל',
      rejected: 'נדחה'
    };
    return labels[status] || status;
  },

  // ===== Export to CSV =====
  exportToCSV(data, filename, headers) {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${this.formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`;
    link.click();
  },

  // ===== WhatsApp Integration =====
  sendWhatsAppMessage(phone, message) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const israeliPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${israeliPhone}?text=${encodedMessage}`, '_blank');
  }
};

// Make Utils globally available
window.Utils = Utils;

// ===== API Client =====
const API = {
  baseURL: '',
  token: null,

  // Initialize with token from storage
  init() {
    this.token = localStorage.getItem('auth_token');
  },

  // Set auth token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  // Get auth headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  },

  // GET request
  async get(url) {
    try {
      const response = await fetch(this.baseURL + url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  },

  // POST request
  async post(url, data) {
    try {
      const response = await fetch(this.baseURL + url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  },

  // PUT request
  async put(url, data) {
    try {
      const response = await fetch(this.baseURL + url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API PUT error:', error);
      throw error;
    }
  },

  // DELETE request
  async delete(url) {
    try {
      const response = await fetch(this.baseURL + url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API DELETE error:', error);
      throw error;
    }
  },

  // Handle unauthorized (redirect to login)
  handleUnauthorized() {
    this.setToken(null);
    // Only redirect if we're not already on login page
    if (typeof Auth !== 'undefined' && Auth.logout) {
      Auth.logout();
    }
  }
};

// Initialize API on load
API.init();
window.API = API;

// Add CSS for fadeOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(10px); }
  }
`;
document.head.appendChild(style);
