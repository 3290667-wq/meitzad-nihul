// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let allRequests = [];
let filteredRequests = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentRequest = null;

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

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const editId = urlParams.get('edit');
  const viewId = urlParams.get('view');

  if (status) {
    document.getElementById('filterStatus').value = status;
  }

  if (editId) {
    setTimeout(() => editRequest(parseInt(editId)), 500);
  }

  if (viewId) {
    setTimeout(() => viewRequest(parseInt(viewId)), 500);
  }
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

      if (!['super_admin', 'admin', 'staff'].includes(currentUser.role)) {
        showToast('אין לך הרשאת גישה לאזור הניהול', 'error');
        window.location.href = '/';
        return;
      }

      document.getElementById('userName').textContent = `שלום, ${currentUser.name}`;
      loadData();
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

// ==================== Data Loading ====================

async function loadData() {
  await Promise.all([
    loadRequests(),
    loadCategories(),
    loadStats()
  ]);
}

async function loadRequests() {
  try {
    const response = await fetch(`${API_BASE}/requests`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      allRequests = await response.json();
      applyFilters();
    }
  } catch (error) {
    console.error('Load requests error:', error);
    showToast('שגיאה בטעינת הפניות', 'error');
  }
}

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/categories`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const categories = await response.json();
      const select = document.getElementById('filterCategory');
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon || ''} ${cat.name}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load categories error:', error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/requests/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const stats = await response.json();

      const byStatus = {};
      if (stats.byStatus) {
        stats.byStatus.forEach(s => {
          byStatus[s.status] = s.count;
        });
      }

      document.getElementById('statNew').textContent = byStatus.new || 0;
      document.getElementById('statInProgress').textContent = (byStatus.in_progress || 0) + (byStatus.pending || 0);
      document.getElementById('statResolved').textContent = (byStatus.resolved || 0) + (byStatus.closed || 0);

      if (stats.avgResolutionHours) {
        const hours = Math.round(stats.avgResolutionHours);
        document.getElementById('statAvgTime').textContent = hours < 24 ? `${hours}ש` : `${Math.round(hours/24)}י`;
      }

      const badge = document.getElementById('newRequestsBadge');
      if (badge) {
        badge.textContent = byStatus.new || 0;
      }
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

// ==================== Filtering ====================

function applyFilters() {
  const status = document.getElementById('filterStatus').value;
  const category = document.getElementById('filterCategory').value;
  const priority = document.getElementById('filterPriority').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  filteredRequests = allRequests.filter(req => {
    if (status && req.status !== status) return false;
    if (category && req.category_id != category) return false;
    if (priority && req.priority !== priority) return false;
    if (search) {
      const searchStr = `${req.request_number} ${req.subject} ${req.submitter_name} ${req.submitter_email}`.toLowerCase();
      if (!searchStr.includes(search)) return false;
    }
    return true;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

// ==================== Rendering ====================

function renderTable() {
  const tbody = document.getElementById('requestsTable');
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageRequests = filteredRequests.slice(start, end);

  if (pageRequests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">לא נמצאו פניות</td></tr>';
    return;
  }

  tbody.innerHTML = pageRequests.map(req => `
    <tr>
      <td><strong>${req.request_number}</strong></td>
      <td>${req.subject}</td>
      <td>${req.category_icon || ''} ${req.category_name || ''}</td>
      <td>${req.submitter_name}</td>
      <td><span class="priority-badge priority-${req.priority}">${PRIORITY_MAP[req.priority]}</span></td>
      <td><span class="status-badge status-${req.status}">${STATUS_MAP[req.status]}</span></td>
      <td>${formatDate(req.created_at)}</td>
      <td>
        <button class="action-btn" onclick="viewRequest(${req.id})" title="צפייה">👁️</button>
        <button class="action-btn" onclick="editRequest(${req.id})" title="עריכה">✏️</button>
        <button class="action-btn" onclick="deleteRequest(${req.id})" title="מחיקה">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function renderPagination() {
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const pagination = document.getElementById('pagination');

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">הקודם</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="page-dots">...</span>';
    }
  }

  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">הבא</button>`;
  }

  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderTable();
  renderPagination();
}

// ==================== Request Actions ====================

async function viewRequest(id) {
  try {
    const response = await fetch(`${API_BASE}/requests/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      currentRequest = await response.json();
      showViewModal(currentRequest);
    } else {
      showToast('שגיאה בטעינת הפנייה', 'error');
    }
  } catch (error) {
    console.error('View request error:', error);
    showToast('שגיאה בטעינת הפנייה', 'error');
  }
}

function showViewModal(request) {
  document.getElementById('modalTitle').textContent = `פנייה ${request.request_number}`;

  document.getElementById('modalBody').innerHTML = `
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
  `;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeRequestModal()">סגור</button>
    <button class="btn btn-primary" onclick="editRequest(${request.id})">עריכה</button>
  `;

  document.getElementById('requestModal').classList.remove('hidden');
}

async function editRequest(id) {
  closeRequestModal();

  try {
    const response = await fetch(`${API_BASE}/requests/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      currentRequest = await response.json();
      showEditModal(currentRequest);
    } else {
      showToast('שגיאה בטעינת הפנייה', 'error');
    }
  } catch (error) {
    console.error('Edit request error:', error);
    showToast('שגיאה בטעינת הפנייה', 'error');
  }
}

function showEditModal(request) {
  document.getElementById('modalTitle').textContent = `עריכת פנייה ${request.request_number}`;

  document.getElementById('modalBody').innerHTML = `
    <form id="editRequestForm">
      <div class="form-row">
        <div class="form-group">
          <label>סטטוס</label>
          <select id="editStatus" name="status">
            <option value="new" ${request.status === 'new' ? 'selected' : ''}>חדש</option>
            <option value="in_progress" ${request.status === 'in_progress' ? 'selected' : ''}>בטיפול</option>
            <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>ממתין</option>
            <option value="resolved" ${request.status === 'resolved' ? 'selected' : ''}>נפתר</option>
            <option value="closed" ${request.status === 'closed' ? 'selected' : ''}>סגור</option>
          </select>
        </div>
        <div class="form-group">
          <label>דחיפות</label>
          <select id="editPriority" name="priority">
            <option value="low" ${request.priority === 'low' ? 'selected' : ''}>נמוכה</option>
            <option value="normal" ${request.priority === 'normal' ? 'selected' : ''}>רגילה</option>
            <option value="high" ${request.priority === 'high' ? 'selected' : ''}>גבוהה</option>
            <option value="urgent" ${request.priority === 'urgent' ? 'selected' : ''}>דחופה</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>הערה / עדכון</label>
        <textarea id="editComment" name="comment" rows="4" placeholder="הוסף הערה או עדכון..."></textarea>
      </div>
    </form>
  `;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeRequestModal()">ביטול</button>
    <button class="btn btn-primary" onclick="saveRequest(${request.id})">שמירה</button>
  `;

  document.getElementById('requestModal').classList.remove('hidden');
}

async function saveRequest(id) {
  const status = document.getElementById('editStatus').value;
  const priority = document.getElementById('editPriority').value;
  const comment = document.getElementById('editComment').value;

  try {
    const response = await fetch(`${API_BASE}/requests/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, priority, comment })
    });

    if (response.ok) {
      showToast('הפנייה עודכנה בהצלחה', 'success');
      closeRequestModal();
      loadData();
    } else {
      showToast('שגיאה בעדכון הפנייה', 'error');
    }
  } catch (error) {
    console.error('Save request error:', error);
    showToast('שגיאה בעדכון הפנייה', 'error');
  }
}

async function deleteRequest(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את הפנייה?')) return;

  try {
    const response = await fetch(`${API_BASE}/requests/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('הפנייה נמחקה בהצלחה', 'success');
      loadData();
    } else {
      showToast('שגיאה במחיקת הפנייה', 'error');
    }
  } catch (error) {
    console.error('Delete request error:', error);
    showToast('שגיאה במחיקת הפנייה', 'error');
  }
}

function showCreateRequestModal() {
  document.getElementById('modalTitle').textContent = 'פנייה חדשה';

  document.getElementById('modalBody').innerHTML = `
    <form id="createRequestForm">
      <div class="form-row">
        <div class="form-group">
          <label>שם מגיש *</label>
          <input type="text" id="newSubmitterName" name="submitter_name" required>
        </div>
        <div class="form-group">
          <label>אימייל *</label>
          <input type="email" id="newSubmitterEmail" name="submitter_email" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>טלפון</label>
          <input type="tel" id="newSubmitterPhone" name="submitter_phone">
        </div>
        <div class="form-group">
          <label>כתובת</label>
          <input type="text" id="newSubmitterAddress" name="submitter_address">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>קטגוריה *</label>
          <select id="newCategoryId" name="category_id" required>
            <option value="">בחר קטגוריה</option>
          </select>
        </div>
        <div class="form-group">
          <label>דחיפות</label>
          <select id="newPriority" name="priority">
            <option value="normal">רגילה</option>
            <option value="low">נמוכה</option>
            <option value="high">גבוהה</option>
            <option value="urgent">דחופה</option>
          </select>
        </div>
      </div>
      <div class="form-group full">
        <label>נושא *</label>
        <input type="text" id="newSubject" name="subject" required>
      </div>
      <div class="form-group full">
        <label>תיאור</label>
        <textarea id="newDescription" name="description" rows="4"></textarea>
      </div>
      <div class="form-group">
        <label>מיקום</label>
        <input type="text" id="newLocation" name="location">
      </div>
    </form>
  `;

  // Load categories into the select
  loadCategoriesForForm();

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeRequestModal()">ביטול</button>
    <button class="btn btn-primary" onclick="createRequest()">יצירה</button>
  `;

  document.getElementById('requestModal').classList.remove('hidden');
}

async function loadCategoriesForForm() {
  try {
    const response = await fetch(`${API_BASE}/categories`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const categories = await response.json();
      const select = document.getElementById('newCategoryId');
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon || ''} ${cat.name}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load categories error:', error);
  }
}

async function createRequest() {
  const formData = {
    submitter_name: document.getElementById('newSubmitterName').value,
    submitter_email: document.getElementById('newSubmitterEmail').value,
    submitter_phone: document.getElementById('newSubmitterPhone').value,
    submitter_address: document.getElementById('newSubmitterAddress').value,
    category_id: document.getElementById('newCategoryId').value,
    priority: document.getElementById('newPriority').value,
    subject: document.getElementById('newSubject').value,
    description: document.getElementById('newDescription').value,
    location: document.getElementById('newLocation').value
  };

  if (!formData.submitter_name || !formData.submitter_email || !formData.category_id || !formData.subject) {
    showToast('נא למלא את כל השדות הנדרשים', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      showToast('הפנייה נוצרה בהצלחה', 'success');
      closeRequestModal();
      loadData();
    } else {
      showToast('שגיאה ביצירת הפנייה', 'error');
    }
  } catch (error) {
    console.error('Create request error:', error);
    showToast('שגיאה ביצירת הפנייה', 'error');
  }
}

function closeRequestModal() {
  document.getElementById('requestModal').classList.add('hidden');
}

// ==================== Sidebar ====================

function toggleSidebar() {
  document.querySelector('.admin-sidebar').classList.toggle('open');
}

// ==================== Utilities ====================

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('he-IL');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('he-IL', {
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
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// Make functions available globally
window.viewRequest = viewRequest;
window.editRequest = editRequest;
window.deleteRequest = deleteRequest;
window.saveRequest = saveRequest;
window.createRequest = createRequest;
window.showCreateRequestModal = showCreateRequestModal;
window.closeRequestModal = closeRequestModal;
window.applyFilters = applyFilters;
window.goToPage = goToPage;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
