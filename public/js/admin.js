// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Status translations
const STATUS_MAP = {
  new: 'חדש',
  in_progress: 'בטיפול',
  pending: 'ממתין',
  resolved: 'נפתר',
  closed: 'סגור'
};

const PRIORITY_MAP = {
  low: 'נמוכה',
  normal: 'רגילה',
  high: 'גבוהה',
  urgent: 'דחופה'
};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// ==================== Authentication ====================

async function checkAuth() {
  if (!authToken) {
    window.location.href = '/#login';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;

      // Check if user has admin access
      if (!['super_admin', 'admin', 'staff'].includes(currentUser.role)) {
        showToast('אין לך הרשאת גישה לאזור הניהול', 'error');
        window.location.href = '/';
        return;
      }

      // Update UI
      document.getElementById('userName').textContent = `שלום, ${currentUser.name}`;

      // Load data
      loadDashboardData();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    logout();
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  window.location.href = '/#login';
}

// ==================== Dashboard Data ====================

async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadRecentRequests(),
    loadCategoryStats()
  ]);

  // Initialize real-time updates
  initializeRealtime();
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/requests/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const stats = await response.json();

      // Process status stats
      const byStatus = {};
      stats.byStatus.forEach(s => {
        byStatus[s.status] = s.count;
      });

      document.getElementById('statNew').textContent = byStatus.new || 0;
      document.getElementById('statInProgress').textContent =
        (byStatus.in_progress || 0) + (byStatus.pending || 0);
      document.getElementById('statResolved').textContent =
        (byStatus.resolved || 0) + (byStatus.closed || 0);

      // Average resolution time
      if (stats.avgResolutionHours) {
        const hours = Math.round(stats.avgResolutionHours);
        if (hours < 24) {
          document.getElementById('statAvgTime').textContent = `${hours} שעות`;
        } else {
          document.getElementById('statAvgTime').textContent = `${Math.round(hours/24)} ימים`;
        }
      }

      // Update badge
      document.getElementById('newRequestsBadge').textContent = byStatus.new || 0;
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

async function loadRecentRequests() {
  try {
    const response = await fetch(`${API_BASE}/requests/recent?limit=10`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const requests = await response.json();
      renderRequestsTable(requests);
    }
  } catch (error) {
    console.error('Load recent requests error:', error);
  }
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('recentRequestsTable');

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">אין פניות</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(req => `
    <tr>
      <td><strong>${req.request_number}</strong></td>
      <td>${req.subject}</td>
      <td>${req.category_icon || ''} ${req.category_name || ''}</td>
      <td>${req.submitter_name}</td>
      <td><span class="status-badge status-${req.status}">${STATUS_MAP[req.status]}</span></td>
      <td>${formatDate(req.created_at)}</td>
      <td>
        <button class="action-btn" onclick="viewRequest(${req.id})" title="צפייה">👁️</button>
        <button class="action-btn" onclick="editRequest(${req.id})" title="עריכה">✏️</button>
      </td>
    </tr>
  `).join('');
}

async function loadCategoryStats() {
  try {
    const response = await fetch(`${API_BASE}/requests/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const stats = await response.json();
      renderCategoryStats(stats.byCategory);
    }
  } catch (error) {
    console.error('Load category stats error:', error);
  }
}

function renderCategoryStats(categories) {
  const container = document.getElementById('categoriesStats');

  container.innerHTML = categories.map(cat => `
    <div class="category-stat">
      <span class="icon">${cat.icon || '📋'}</span>
      <div class="info">
        <span class="name">${cat.category}</span>
        <span class="count">${cat.count}</span>
      </div>
    </div>
  `).join('');
}

// ==================== Request Actions ====================

async function viewRequest(id) {
  try {
    const response = await fetch(`${API_BASE}/requests/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const request = await response.json();
      showRequestModal(request);
    } else {
      showToast('שגיאה בטעינת הפנייה', 'error');
    }
  } catch (error) {
    console.error('View request error:', error);
    showToast('שגיאה בטעינת הפנייה', 'error');
  }
}

function showRequestModal(request) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>פנייה ${request.request_number}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="request-details">
          <div class="detail-group">
            <div class="detail-item">
              <label>מגיש הפנייה</label>
              <span>${request.submitter_name}</span>
            </div>
            <div class="detail-item">
              <label>אימייל</label>
              <span>${request.submitter_email}</span>
            </div>
            <div class="detail-item">
              <label>טלפון</label>
              <span>${request.submitter_phone || '-'}</span>
            </div>
            <div class="detail-item">
              <label>כתובת</label>
              <span>${request.submitter_address || '-'}</span>
            </div>
          </div>

          <div class="detail-group">
            <div class="detail-item">
              <label>קטגוריה</label>
              <span>${request.category_icon || ''} ${request.category_name || ''}</span>
            </div>
            <div class="detail-item">
              <label>דחיפות</label>
              <span class="priority-badge priority-${request.priority}">${PRIORITY_MAP[request.priority]}</span>
            </div>
            <div class="detail-item">
              <label>סטטוס</label>
              <span class="status-badge status-${request.status}">${STATUS_MAP[request.status]}</span>
            </div>
            <div class="detail-item">
              <label>מוקצה ל</label>
              <span>${request.assigned_name || 'לא הוקצה'}</span>
            </div>
          </div>

          <div class="detail-item full">
            <label>נושא</label>
            <span>${request.subject}</span>
          </div>

          <div class="detail-item full">
            <label>תיאור</label>
            <div class="description-box">${request.description || 'ללא תיאור'}</div>
          </div>

          ${request.location ? `
            <div class="detail-item full">
              <label>מיקום</label>
              <span>${request.location}</span>
            </div>
          ` : ''}

          <div class="detail-group">
            <div class="detail-item">
              <label>תאריך הגשה</label>
              <span>${formatDateTime(request.created_at)}</span>
            </div>
            <div class="detail-item">
              <label>עדכון אחרון</label>
              <span>${formatDateTime(request.updated_at)}</span>
            </div>
          </div>

          ${request.updates && request.updates.length > 0 ? `
            <div class="updates-timeline">
              <h4>היסטוריית פעולות</h4>
              ${request.updates.map(update => `
                <div class="timeline-item">
                  <div class="timeline-icon">📝</div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-user">${update.user_name || 'מערכת'}</span>
                      <span class="timeline-date">${formatDateTime(update.created_at)}</span>
                    </div>
                    <div class="timeline-text">${update.comment || update.action}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">סגור</button>
        <button class="btn btn-primary" onclick="editRequest(${request.id}); this.closest('.modal-overlay').remove();">עריכה</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function editRequest(id) {
  // Redirect to requests page with edit mode
  window.location.href = `/admin/requests.html?edit=${id}`;
}

// ==================== Real-time Updates ====================

function initializeRealtime() {
  // Check if Socket.io is available
  if (typeof io === 'undefined') {
    // Load Socket.io
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = setupSocket;
    document.head.appendChild(script);
  } else {
    setupSocket();
  }
}

function setupSocket() {
  if (typeof io === 'undefined') {
    console.log('Socket.io not available, real-time updates disabled');
    return;
  }

  const socket = io({
    auth: { token: authToken }
  });

  socket.on('connect', () => {
    console.log('Connected to real-time updates');
    socket.emit('subscribe:requests');
  });

  socket.on('request:created', (request) => {
    showToast(`פנייה חדשה: ${request.subject}`, 'info');
    loadDashboardData();
  });

  socket.on('request:updated', (request) => {
    loadDashboardData();
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from real-time updates');
  });
}

// ==================== Utilities ====================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('he-IL', {
    year: 'numeric',
    month: 'short',
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
window.viewRequest = viewRequest;
window.editRequest = editRequest;
window.logout = logout;
