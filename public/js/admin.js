// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
// Support both token names for compatibility
let authToken = localStorage.getItem('meitzad_token') || localStorage.getItem('authToken');

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

const EVENT_TYPE_MAP = {
  general: 'כללי',
  community: 'קהילתי',
  kids: 'ילדים',
  sports: 'ספורט',
  culture: 'תרבות',
  holiday: 'חג',
  meeting: 'ישיבה',
  emergency: 'חירום'
};

const ANNOUNCEMENT_TYPE_MAP = {
  info: { label: 'מידע', icon: 'ℹ️' },
  important: { label: 'חשוב', icon: '⚠️' },
  urgent: { label: 'דחוף', icon: '🚨' },
  warning: { label: 'אזהרה', icon: '⚡' },
  celebration: { label: 'חגיגה', icon: '🎉' }
};

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  updateDateTime();
  setInterval(updateDateTime, 60000);
});

function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('currentDate');
  if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString('he-IL', options);
  }

  // Update welcome message based on time
  const hour = now.getHours();
  const welcomeElement = document.getElementById('welcomeMessage');
  if (welcomeElement) {
    if (hour < 12) {
      welcomeElement.textContent = 'בוקר טוב!';
    } else if (hour < 17) {
      welcomeElement.textContent = 'צהריים טובים!';
    } else if (hour < 21) {
      welcomeElement.textContent = 'ערב טוב!';
    } else {
      welcomeElement.textContent = 'לילה טוב!';
    }
  }
}

// ==================== Authentication ====================

async function checkAuth() {
  if (!authToken) {
    window.location.href = '/';
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
  localStorage.removeItem('meitzad_token');
  localStorage.removeItem('meitzad_user');
  window.location.href = '/';
}

// ==================== Dashboard Data ====================

async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadRecentRequests(),
    loadCategoryStats(),
    loadRecentAnnouncements(),
    loadUpcomingEvents(),
    loadPendingBookings(),
    loadActivePolls(),
    loadEmergencyContacts(),
    loadQuickLinks()
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
      if (stats.byStatus) {
        stats.byStatus.forEach(s => {
          byStatus[s.status] = s.count;
        });
      }

      document.getElementById('statNew').textContent = byStatus.new || 0;
      document.getElementById('statInProgress').textContent =
        (byStatus.in_progress || 0) + (byStatus.pending || 0);

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
      const newBadge = document.getElementById('newRequestsBadge');
      if (newBadge) {
        newBadge.textContent = byStatus.new || 0;
      }
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }

  // Load community stats
  try {
    const [eventsRes, bookingsRes, pollsRes] = await Promise.all([
      fetch(`${API_BASE}/events/upcoming?limit=100`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null),
      fetch(`${API_BASE}/facilities/bookings/pending`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null),
      fetch(`${API_BASE}/polls/active`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null)
    ]);

    if (eventsRes && eventsRes.ok) {
      const events = await eventsRes.json();
      document.getElementById('statUpcomingEvents').textContent = events.length || 0;
    }

    if (bookingsRes && bookingsRes.ok) {
      const bookings = await bookingsRes.json();
      document.getElementById('statPendingBookings').textContent = bookings.length || 0;
      const badge = document.getElementById('pendingBookingsBadge');
      if (badge && bookings.length > 0) {
        badge.textContent = bookings.length;
        badge.style.display = 'inline-flex';
      }
    }

    if (pollsRes && pollsRes.ok) {
      const polls = await pollsRes.json();
      document.getElementById('statActivePolls').textContent = polls.length || 0;
    }
  } catch (error) {
    console.error('Load community stats error:', error);
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

  if (!requests || requests.length === 0) {
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
      renderCategoryStats(stats.byCategory || []);
    }
  } catch (error) {
    console.error('Load category stats error:', error);
  }
}

function renderCategoryStats(categories) {
  const container = document.getElementById('categoriesStats');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>אין נתונים</p></div>';
    return;
  }

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

// ==================== Announcements ====================

async function loadRecentAnnouncements() {
  const container = document.getElementById('recentAnnouncements');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/announcements/recent?limit=5`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const announcements = await response.json();
      renderAnnouncements(announcements);
    } else {
      // API might not exist yet - show empty state
      renderAnnouncements([]);
    }
  } catch (error) {
    console.error('Load announcements error:', error);
    renderAnnouncements([]);
  }
}

function renderAnnouncements(announcements) {
  const container = document.getElementById('recentAnnouncements');
  if (!container) return;

  if (!announcements || announcements.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <p>אין הודעות אחרונות</p>
        <button class="btn btn-primary btn-sm" onclick="createNewAnnouncement()">צור הודעה חדשה</button>
      </div>
    `;
    return;
  }

  container.innerHTML = announcements.map(a => {
    const typeInfo = ANNOUNCEMENT_TYPE_MAP[a.type] || ANNOUNCEMENT_TYPE_MAP.info;
    return `
      <div class="announcement-item ${a.type}">
        <span class="announcement-type-icon">${typeInfo.icon}</span>
        <div class="announcement-content">
          <div class="announcement-title">${a.title}</div>
          <div class="announcement-excerpt">${a.content ? a.content.substring(0, 100) : ''}${a.content && a.content.length > 100 ? '...' : ''}</div>
          <div class="announcement-date">${formatDate(a.publish_date || a.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function createNewAnnouncement() {
  window.location.href = '/admin/announcements.html?action=new';
}

// ==================== Events ====================

async function loadUpcomingEvents() {
  const container = document.getElementById('upcomingEvents');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/events/upcoming?limit=5`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const events = await response.json();
      renderEvents(events);
    } else {
      renderEvents([]);
    }
  } catch (error) {
    console.error('Load events error:', error);
    renderEvents([]);
  }
}

function renderEvents(events) {
  const container = document.getElementById('upcomingEvents');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>אין אירועים קרובים</p>
        <button class="btn btn-primary btn-sm" onclick="createNewEvent()">צור אירוע חדש</button>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(e => {
    const date = new Date(e.start_date);
    const day = date.getDate();
    const month = HEBREW_MONTHS[date.getMonth()].substring(0, 3);

    return `
      <div class="event-item" onclick="viewEvent(${e.id})">
        <div class="event-date-badge">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="event-info">
          <div class="event-title">${e.title}</div>
          <div class="event-meta">
            <span>🕐 ${formatTime(e.start_date)}</span>
            ${e.location ? `<span>📍 ${e.location}</span>` : ''}
          </div>
          ${e.registration_required && e.max_participants ?
            `<div class="event-registrations">${e.current_participants || 0}/${e.max_participants} נרשמו</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function createNewEvent() {
  window.location.href = '/admin/events.html?action=new';
}

function viewEvent(id) {
  window.location.href = `/admin/events.html?view=${id}`;
}

// ==================== Facility Bookings ====================

async function loadPendingBookings() {
  const container = document.getElementById('pendingBookings');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/facilities/bookings/pending`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const bookings = await response.json();
      renderBookings(bookings);
    } else {
      renderBookings([]);
    }
  } catch (error) {
    console.error('Load bookings error:', error);
    renderBookings([]);
  }
}

function renderBookings(bookings) {
  const container = document.getElementById('pendingBookings');
  if (!container) return;

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏛️</div>
        <p>אין הזמנות ממתינות לאישור</p>
      </div>
    `;
    return;
  }

  container.innerHTML = bookings.slice(0, 5).map(b => `
    <div class="booking-item">
      <div class="booking-info">
        <div class="booking-facility">${b.facility_name || 'מתקן'}</div>
        <div class="booking-details">
          ${formatDate(b.booking_date)} | ${b.start_time} - ${b.end_time}
          ${b.user_name ? ` | ${b.user_name}` : ''}
        </div>
      </div>
      <div class="booking-actions">
        <button class="approve-btn" onclick="approveBooking(${b.id})">אישור</button>
        <button class="reject-btn" onclick="rejectBooking(${b.id})">דחייה</button>
      </div>
    </div>
  `).join('');
}

async function approveBooking(id) {
  try {
    const response = await fetch(`${API_BASE}/facilities/bookings/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('ההזמנה אושרה בהצלחה', 'success');
      loadPendingBookings();
      loadStats();
    } else {
      showToast('שגיאה באישור ההזמנה', 'error');
    }
  } catch (error) {
    console.error('Approve booking error:', error);
    showToast('שגיאה באישור ההזמנה', 'error');
  }
}

async function rejectBooking(id) {
  const reason = prompt('סיבת הדחייה (אופציונלי):');

  try {
    const response = await fetch(`${API_BASE}/facilities/bookings/${id}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (response.ok) {
      showToast('ההזמנה נדחתה', 'success');
      loadPendingBookings();
      loadStats();
    } else {
      showToast('שגיאה בדחיית ההזמנה', 'error');
    }
  } catch (error) {
    console.error('Reject booking error:', error);
    showToast('שגיאה בדחיית ההזמנה', 'error');
  }
}

// ==================== Polls ====================

async function loadActivePolls() {
  const container = document.getElementById('activePolls');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/polls/active`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const polls = await response.json();
      renderPolls(polls);
    } else {
      renderPolls([]);
    }
  } catch (error) {
    console.error('Load polls error:', error);
    renderPolls([]);
  }
}

function renderPolls(polls) {
  const container = document.getElementById('activePolls');
  if (!container) return;

  if (!polls || polls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🗳️</div>
        <p>אין סקרים פעילים</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.href='/admin/polls.html?action=new'">צור סקר חדש</button>
      </div>
    `;
    return;
  }

  container.innerHTML = polls.slice(0, 3).map(p => {
    const totalVotes = p.total_votes || 0;
    const maxVotes = p.max_votes || 100;
    const percentage = maxVotes > 0 ? Math.round((totalVotes / maxVotes) * 100) : 0;

    return `
      <div class="poll-item" onclick="window.location.href='/admin/polls.html?view=${p.id}'">
        <div class="poll-title">${p.title}</div>
        <div class="poll-progress">
          <div class="poll-progress-bar">
            <div class="poll-progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="poll-votes">${totalVotes} הצבעות</span>
        </div>
        ${p.end_date ? `<div class="poll-end-date">מסתיים: ${formatDate(p.end_date)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ==================== Emergency Contacts ====================

async function loadEmergencyContacts() {
  const container = document.getElementById('emergencyContacts');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/emergency-contacts`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const contacts = await response.json();
      renderEmergencyContacts(contacts);
    } else {
      // Fallback to default contacts
      renderEmergencyContacts([
        { name: 'קב"ט היישוב', phone: '050-0000000', category: 'security' },
        { name: 'מוקד חירום', phone: '100', category: 'external' },
        { name: 'מד"א', phone: '101', category: 'medical' },
        { name: 'כיבוי אש', phone: '102', category: 'external' }
      ]);
    }
  } catch (error) {
    console.error('Load emergency contacts error:', error);
    renderEmergencyContacts([]);
  }
}

function renderEmergencyContacts(contacts) {
  const container = document.getElementById('emergencyContacts');
  if (!container) return;

  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>אין אנשי קשר לחירום</p></div>';
    return;
  }

  const categoryIcons = {
    security: '🔒',
    medical: '🏥',
    infrastructure: '🔧',
    committee: '👤',
    external: '📞'
  };

  container.innerHTML = contacts.slice(0, 6).map(c => `
    <div class="emergency-contact-item">
      <div class="emergency-contact-icon">${categoryIcons[c.category] || '📞'}</div>
      <div class="emergency-contact-info">
        <div class="emergency-contact-name">${c.name}</div>
        <div class="emergency-contact-phone">${c.phone}</div>
      </div>
    </div>
  `).join('');
}

// ==================== Quick Links ====================

async function loadQuickLinks() {
  const container = document.getElementById('quickLinks');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/quick-links`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const links = await response.json();
      renderQuickLinks(links);
    } else {
      // Fallback to default links
      renderQuickLinks([
        { title: 'אתר המועצה', url: 'https://council.gov.il', icon: '🏛️' },
        { title: 'דואר ישראל', url: 'https://israelpost.co.il', icon: '📮' },
        { title: 'חברת חשמל', url: 'https://iec.co.il', icon: '⚡' }
      ]);
    }
  } catch (error) {
    console.error('Load quick links error:', error);
    renderQuickLinks([]);
  }
}

function renderQuickLinks(links) {
  const container = document.getElementById('quickLinks');
  if (!container) return;

  if (!links || links.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>אין קישורים מהירים</p></div>';
    return;
  }

  container.innerHTML = links.map(l => `
    <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="quick-link-item">
      <span class="quick-link-icon">${l.icon || '🔗'}</span>
      <span class="quick-link-title">${l.title}</span>
    </a>
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

// ==================== Notifications ====================

function showNotificationsPanel() {
  const panel = document.getElementById('notificationPanel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

function closeNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

// ==================== Sidebar Toggle ====================

function toggleSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
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
    socket.emit('subscribe:announcements');
    socket.emit('subscribe:events');
  });

  socket.on('request:created', (request) => {
    showToast(`פנייה חדשה: ${request.subject}`, 'info');
    loadDashboardData();
  });

  socket.on('request:updated', (request) => {
    loadDashboardData();
  });

  socket.on('announcement:created', (announcement) => {
    showToast(`הודעה חדשה: ${announcement.title}`, 'info');
    loadRecentAnnouncements();
  });

  socket.on('event:created', (event) => {
    showToast(`אירוע חדש: ${event.title}`, 'info');
    loadUpcomingEvents();
  });

  socket.on('booking:created', (booking) => {
    showToast('הזמנה חדשה ממתינה לאישור', 'info');
    loadPendingBookings();
    loadStats();
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

function formatTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit'
  });
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

// Make functions available globally
window.viewRequest = viewRequest;
window.editRequest = editRequest;
window.logout = logout;
window.createNewAnnouncement = createNewAnnouncement;
window.createNewEvent = createNewEvent;
window.viewEvent = viewEvent;
window.approveBooking = approveBooking;
window.rejectBooking = rejectBooking;
window.showNotificationsPanel = showNotificationsPanel;
window.closeNotificationPanel = closeNotificationPanel;
window.toggleSidebar = toggleSidebar;
