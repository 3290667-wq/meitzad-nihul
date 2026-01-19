// Announcements Management Module
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let allAnnouncements = [];
let currentViewAnnouncementId = null;

const ANNOUNCEMENT_TYPES = {
  info: { label: 'מידע', icon: 'ℹ️', color: '#3b82f6' },
  important: { label: 'חשוב', icon: '⚠️', color: '#f59e0b' },
  urgent: { label: 'דחוף', icon: '🚨', color: '#ef4444' },
  warning: { label: 'אזהרה', icon: '⚡', color: '#8b5cf6' },
  celebration: { label: 'חגיגה', icon: '🎉', color: '#10b981' }
};

const AUDIENCE_LABELS = {
  all: 'כל התושבים',
  residents: 'תושבים בלבד',
  committee: 'חברי וועד',
  parents: 'הורים',
  youth: 'נוער',
  elderly: 'קשישים'
};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  checkUrlParams();
});

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

      loadAnnouncements();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    logout();
  }
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('action') === 'new') {
    setTimeout(() => showCreateAnnouncementModal(), 500);
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  window.location.href = '/#login';
}

// ==================== Load Announcements ====================

async function loadAnnouncements() {
  try {
    const response = await fetch(`${API_BASE}/announcements`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      allAnnouncements = await response.json();
    } else {
      allAnnouncements = [];
    }
  } catch (error) {
    console.error('Load announcements error:', error);
    allAnnouncements = [];
  }

  updateStats();
  renderAnnouncements();
}

function updateStats() {
  const now = new Date();

  // Total
  document.getElementById('statTotal').textContent = allAnnouncements.length;

  // Active (published and not expired)
  const active = allAnnouncements.filter(a => {
    const publishDate = a.publish_date ? new Date(a.publish_date) : new Date(a.created_at);
    const expireDate = a.expire_date ? new Date(a.expire_date) : null;
    return publishDate <= now && (!expireDate || expireDate > now);
  });
  document.getElementById('statActive').textContent = active.length;

  // Urgent
  const urgent = allAnnouncements.filter(a => a.type === 'urgent');
  document.getElementById('statUrgent').textContent = urgent.length;

  // Pinned
  const pinned = allAnnouncements.filter(a => a.is_pinned === 1);
  document.getElementById('statPinned').textContent = pinned.length;
}

function filterAnnouncements() {
  renderAnnouncements();
}

function getFilteredAnnouncements() {
  const typeFilter = document.getElementById('filterType')?.value || '';
  const audienceFilter = document.getElementById('filterAudience')?.value || '';
  const searchQuery = document.getElementById('searchQuery')?.value?.toLowerCase() || '';
  const sortBy = document.getElementById('sortBy')?.value || 'date_desc';

  let filtered = allAnnouncements.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (audienceFilter && a.target_audience !== audienceFilter) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery) && !a.content?.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // Sort
  switch (sortBy) {
    case 'date_asc':
      filtered.sort((a, b) => new Date(a.publish_date || a.created_at) - new Date(b.publish_date || b.created_at));
      break;
    case 'priority':
      filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      break;
    case 'views':
      filtered.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
      break;
    default: // date_desc
      filtered.sort((a, b) => new Date(b.publish_date || b.created_at) - new Date(a.publish_date || a.created_at));
  }

  // Pinned always first
  const pinned = filtered.filter(a => a.is_pinned === 1);
  const notPinned = filtered.filter(a => a.is_pinned !== 1);

  return [...pinned, ...notPinned];
}

function renderAnnouncements() {
  const container = document.getElementById('announcementsList');
  if (!container) return;

  const filtered = getFilteredAnnouncements();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <h3>אין הודעות</h3>
        <p>לא נמצאו הודעות בהתאם לסינון</p>
        <button class="btn btn-primary" onclick="showCreateAnnouncementModal()">צור הודעה חדשה</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => renderAnnouncementCard(a)).join('');
}

function renderAnnouncementCard(announcement) {
  const type = ANNOUNCEMENT_TYPES[announcement.type] || ANNOUNCEMENT_TYPES.info;
  const now = new Date();
  const expireDate = announcement.expire_date ? new Date(announcement.expire_date) : null;
  const isExpired = expireDate && expireDate < now;

  return `
    <div class="announcement-card ${announcement.is_pinned ? 'pinned' : ''} ${isExpired ? 'expired' : ''} ${announcement.type}"
         style="border-right: 4px solid ${type.color}"
         onclick="viewAnnouncement(${announcement.id})">
      <div class="announcement-card-header">
        <span class="announcement-type-badge" style="background: ${type.color}20; color: ${type.color}">
          ${type.icon} ${type.label}
        </span>
        ${announcement.is_pinned ? '<span class="pinned-badge">📌 נעוץ</span>' : ''}
        ${isExpired ? '<span class="expired-badge">פג תוקף</span>' : ''}
      </div>
      <h3 class="announcement-card-title">${announcement.title}</h3>
      <p class="announcement-card-content">${announcement.content ? announcement.content.substring(0, 150) : ''}${announcement.content && announcement.content.length > 150 ? '...' : ''}</p>
      <div class="announcement-card-footer">
        <span class="announcement-date">📅 ${formatDate(announcement.publish_date || announcement.created_at)}</span>
        <span class="announcement-audience">👥 ${AUDIENCE_LABELS[announcement.target_audience] || 'הכל'}</span>
        <span class="announcement-views">👁️ ${announcement.views_count || 0} צפיות</span>
      </div>
      <div class="announcement-card-actions">
        <button class="action-btn" onclick="event.stopPropagation(); editAnnouncement(${announcement.id})" title="עריכה">✏️</button>
        <button class="action-btn" onclick="event.stopPropagation(); togglePin(${announcement.id})" title="${announcement.is_pinned ? 'בטל נעיצה' : 'נעץ'}">📌</button>
        <button class="action-btn danger" onclick="event.stopPropagation(); deleteAnnouncement(${announcement.id})" title="מחיקה">🗑️</button>
      </div>
    </div>
  `;
}

// ==================== Create/Edit Announcement ====================

function showCreateAnnouncementModal() {
  document.getElementById('announcementModalTitle').textContent = 'יצירת הודעה חדשה';
  document.getElementById('announcementForm').reset();
  document.getElementById('announcementId').value = '';
  document.getElementById('announcementSendNotification').checked = true;

  document.getElementById('announcementModal').classList.remove('hidden');
}

function showEditAnnouncementModal(announcement) {
  document.getElementById('announcementModalTitle').textContent = 'עריכת הודעה';
  document.getElementById('announcementId').value = announcement.id;
  document.getElementById('announcementTitle').value = announcement.title || '';
  document.getElementById('announcementType').value = announcement.type || 'info';
  document.getElementById('announcementAudience').value = announcement.target_audience || 'all';
  document.getElementById('announcementContent').value = announcement.content || '';
  document.getElementById('announcementPublishDate').value = announcement.publish_date ? formatDateTimeLocal(new Date(announcement.publish_date)) : '';
  document.getElementById('announcementExpireDate').value = announcement.expire_date ? formatDateTimeLocal(new Date(announcement.expire_date)) : '';
  document.getElementById('announcementPriority').value = announcement.priority || 0;
  document.getElementById('announcementPinned').checked = announcement.is_pinned === 1;
  document.getElementById('announcementSendNotification').checked = false; // Don't resend on edit

  document.getElementById('announcementModal').classList.remove('hidden');
}

function closeAnnouncementModal() {
  document.getElementById('announcementModal').classList.add('hidden');
}

async function saveAnnouncement(e) {
  e.preventDefault();

  const announcementId = document.getElementById('announcementId').value;
  const isEdit = !!announcementId;

  const data = {
    title: document.getElementById('announcementTitle').value,
    type: document.getElementById('announcementType').value,
    target_audience: document.getElementById('announcementAudience').value,
    content: document.getElementById('announcementContent').value,
    publish_date: document.getElementById('announcementPublishDate').value || null,
    expire_date: document.getElementById('announcementExpireDate').value || null,
    priority: parseInt(document.getElementById('announcementPriority').value) || 0,
    is_pinned: document.getElementById('announcementPinned').checked ? 1 : 0,
    send_notification: document.getElementById('announcementSendNotification').checked ? 1 : 0
  };

  try {
    const url = isEdit ? `${API_BASE}/announcements/${announcementId}` : `${API_BASE}/announcements`;
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      showToast(isEdit ? 'ההודעה עודכנה בהצלחה' : 'ההודעה פורסמה בהצלחה', 'success');
      closeAnnouncementModal();
      loadAnnouncements();
    } else {
      const error = await response.json();
      showToast(error.message || 'שגיאה בשמירת ההודעה', 'error');
    }
  } catch (error) {
    console.error('Save announcement error:', error);
    showToast('שגיאה בשמירת ההודעה', 'error');
  }
}

// ==================== View Announcement ====================

async function viewAnnouncement(id) {
  currentViewAnnouncementId = id;
  const announcement = allAnnouncements.find(a => a.id === id);

  if (announcement) {
    showViewAnnouncementModal(announcement);
  } else {
    try {
      const response = await fetch(`${API_BASE}/announcements/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const fetchedAnnouncement = await response.json();
        showViewAnnouncementModal(fetchedAnnouncement);
      } else {
        showToast('ההודעה לא נמצאה', 'error');
      }
    } catch (error) {
      showToast('שגיאה בטעינת ההודעה', 'error');
    }
  }
}

function showViewAnnouncementModal(announcement) {
  const type = ANNOUNCEMENT_TYPES[announcement.type] || ANNOUNCEMENT_TYPES.info;

  document.getElementById('viewAnnouncementTitle').innerHTML = `${type.icon} ${announcement.title}`;

  document.getElementById('viewAnnouncementContent').innerHTML = `
    <div class="view-announcement-details">
      <div class="view-announcement-meta">
        <span class="meta-item" style="background: ${type.color}20; color: ${type.color}">
          ${type.icon} ${type.label}
        </span>
        <span class="meta-item">👥 ${AUDIENCE_LABELS[announcement.target_audience] || 'הכל'}</span>
        ${announcement.is_pinned ? '<span class="meta-item pinned">📌 נעוץ</span>' : ''}
      </div>

      <div class="view-announcement-content">
        ${announcement.content ? announcement.content.replace(/\n/g, '<br>') : ''}
      </div>

      <div class="view-announcement-info">
        <div class="info-row">
          <span class="info-label">תאריך פרסום:</span>
          <span class="info-value">${formatDateTime(announcement.publish_date || announcement.created_at)}</span>
        </div>
        ${announcement.expire_date ? `
          <div class="info-row">
            <span class="info-label">תפוגה:</span>
            <span class="info-value">${formatDateTime(announcement.expire_date)}</span>
          </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">צפיות:</span>
          <span class="info-value">${announcement.views_count || 0}</span>
        </div>
        ${announcement.created_by_name ? `
          <div class="info-row">
            <span class="info-label">נוצר ע"י:</span>
            <span class="info-value">${announcement.created_by_name}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('viewAnnouncementModal').classList.remove('hidden');
}

function closeViewAnnouncementModal() {
  document.getElementById('viewAnnouncementModal').classList.add('hidden');
  currentViewAnnouncementId = null;
}

function editAnnouncementFromView() {
  const announcement = allAnnouncements.find(a => a.id === currentViewAnnouncementId);
  if (announcement) {
    closeViewAnnouncementModal();
    showEditAnnouncementModal(announcement);
  }
}

async function deleteAnnouncementFromView() {
  if (!confirm('האם אתה בטוח שברצונך למחוק את ההודעה?')) return;
  await deleteAnnouncement(currentViewAnnouncementId);
  closeViewAnnouncementModal();
}

// ==================== Actions ====================

function editAnnouncement(id) {
  const announcement = allAnnouncements.find(a => a.id === id);
  if (announcement) {
    showEditAnnouncementModal(announcement);
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את ההודעה?')) return;

  try {
    const response = await fetch(`${API_BASE}/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('ההודעה נמחקה בהצלחה', 'success');
      loadAnnouncements();
    } else {
      showToast('שגיאה במחיקת ההודעה', 'error');
    }
  } catch (error) {
    showToast('שגיאה במחיקת ההודעה', 'error');
  }
}

async function togglePin(id) {
  const announcement = allAnnouncements.find(a => a.id === id);
  if (!announcement) return;

  try {
    const response = await fetch(`${API_BASE}/announcements/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...announcement,
        is_pinned: announcement.is_pinned ? 0 : 1
      })
    });

    if (response.ok) {
      showToast(announcement.is_pinned ? 'ההודעה בוטלה מנעיצה' : 'ההודעה נעוצה בהצלחה', 'success');
      loadAnnouncements();
    } else {
      showToast('שגיאה בעדכון ההודעה', 'error');
    }
  } catch (error) {
    showToast('שגיאה בעדכון ההודעה', 'error');
  }
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

function formatDateTimeLocal(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function toggleSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

// Make functions available globally
window.logout = logout;
window.showCreateAnnouncementModal = showCreateAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.closeViewAnnouncementModal = closeViewAnnouncementModal;
window.saveAnnouncement = saveAnnouncement;
window.viewAnnouncement = viewAnnouncement;
window.editAnnouncement = editAnnouncement;
window.editAnnouncementFromView = editAnnouncementFromView;
window.deleteAnnouncement = deleteAnnouncement;
window.deleteAnnouncementFromView = deleteAnnouncementFromView;
window.togglePin = togglePin;
window.filterAnnouncements = filterAnnouncements;
window.toggleSidebar = toggleSidebar;
