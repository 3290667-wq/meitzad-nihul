// Events Management Module
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let allEvents = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentViewEventId = null;

const EVENT_TYPES = {
  general: { label: 'כללי', icon: '📋', color: '#6b7280' },
  community: { label: 'קהילתי', icon: '👨‍👩‍👧‍👦', color: '#2ea1b3' },
  kids: { label: 'ילדים', icon: '🧒', color: '#f59e0b' },
  sports: { label: 'ספורט', icon: '⚽', color: '#10b981' },
  culture: { label: 'תרבות', icon: '🎭', color: '#8b5cf6' },
  holiday: { label: 'חג', icon: '🎉', color: '#ef4444' },
  meeting: { label: 'ישיבה', icon: '📝', color: '#3b82f6' },
  emergency: { label: 'חירום', icon: '🚨', color: '#dc2626' }
};

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

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

      loadEvents();
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
    setTimeout(() => showCreateEventModal(), 500);
  }

  if (params.get('view')) {
    setTimeout(() => viewEvent(parseInt(params.get('view'))), 500);
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  window.location.href = '/#login';
}

// ==================== Load Events ====================

async function loadEvents() {
  try {
    const response = await fetch(`${API_BASE}/events`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      allEvents = await response.json();
    } else {
      // API might not exist - use empty array
      allEvents = [];
    }
  } catch (error) {
    console.error('Load events error:', error);
    allEvents = [];
  }

  renderCalendar();
  renderEventsList();
  renderUpcomingEvents();
}

function filterEvents() {
  renderCalendar();
  renderEventsList();
}

function getFilteredEvents() {
  const typeFilter = document.getElementById('filterType')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';

  return allEvents.filter(e => {
    if (typeFilter && e.event_type !== typeFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });
}

// ==================== Calendar View ====================

function renderCalendar() {
  const monthLabel = document.getElementById('currentMonth');
  if (monthLabel) {
    monthLabel.textContent = `${HEBREW_MONTHS[currentMonth]} ${currentYear}`;
  }

  const container = document.getElementById('calendarDays');
  if (!container) return;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const filteredEvents = getFilteredEvents();

  // Create event map by date
  const eventsByDate = {};
  filteredEvents.forEach(e => {
    const date = new Date(e.start_date);
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      const dayKey = date.getDate();
      if (!eventsByDate[dayKey]) eventsByDate[dayKey] = [];
      eventsByDate[dayKey].push(e);
    }
  });

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of the month
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const isToday = today.getDate() === day &&
                    today.getMonth() === currentMonth &&
                    today.getFullYear() === currentYear;

    const dayEvents = eventsByDate[day] || [];

    html += `
      <div class="calendar-day ${isToday ? 'today' : ''}" onclick="showDayEvents(${day})">
        <span class="day-number">${day}</span>
        <div class="day-events">
          ${dayEvents.slice(0, 3).map(e => {
            const type = EVENT_TYPES[e.event_type] || EVENT_TYPES.general;
            return `<div class="day-event" style="background: ${type.color}20; border-right: 3px solid ${type.color};" onclick="event.stopPropagation(); viewEvent(${e.id})">
              <span class="event-icon">${type.icon}</span>
              <span class="event-title">${e.title}</span>
            </div>`;
          }).join('')}
          ${dayEvents.length > 3 ? `<div class="more-events">+${dayEvents.length - 3} נוספים</div>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function showDayEvents(day) {
  const filteredEvents = getFilteredEvents();
  const dayEvents = filteredEvents.filter(e => {
    const date = new Date(e.start_date);
    return date.getDate() === day &&
           date.getMonth() === currentMonth &&
           date.getFullYear() === currentYear;
  });

  if (dayEvents.length === 0) {
    // Open create modal with pre-filled date
    const date = new Date(currentYear, currentMonth, day);
    showCreateEventModal(date);
  } else if (dayEvents.length === 1) {
    viewEvent(dayEvents[0].id);
  } else {
    // Show list of events for this day
    showDayEventsModal(day, dayEvents);
  }
}

function showDayEventsModal(day, events) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>אירועים ביום ${day} ${HEBREW_MONTHS[currentMonth]}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="day-events-list">
          ${events.map(e => {
            const type = EVENT_TYPES[e.event_type] || EVENT_TYPES.general;
            return `
              <div class="day-event-item" onclick="this.closest('.modal-overlay').remove(); viewEvent(${e.id})">
                <span class="event-type-icon" style="background: ${type.color}">${type.icon}</span>
                <div class="event-details">
                  <div class="event-name">${e.title}</div>
                  <div class="event-time">${formatTime(e.start_date)}${e.end_date ? ' - ' + formatTime(e.end_date) : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); showCreateEventModal(new Date(${currentYear}, ${currentMonth}, ${day}))">הוסף אירוע</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ==================== List View ====================

function changeViewMode(mode) {
  const calendarView = document.getElementById('calendarView');
  const listView = document.getElementById('listView');

  if (mode === 'calendar') {
    calendarView.style.display = 'block';
    listView.style.display = 'none';
  } else {
    calendarView.style.display = 'none';
    listView.style.display = 'block';
    renderEventsList();
  }
}

function renderEventsList() {
  const container = document.getElementById('eventsList');
  if (!container) return;

  const filteredEvents = getFilteredEvents();

  // Sort by start date
  const sortedEvents = [...filteredEvents].sort((a, b) =>
    new Date(a.start_date) - new Date(b.start_date)
  );

  if (sortedEvents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>אין אירועים</h3>
        <p>לא נמצאו אירועים בהתאם לסינון</p>
        <button class="btn btn-primary" onclick="showCreateEventModal()">צור אירוע חדש</button>
      </div>
    `;
    return;
  }

  // Group by month
  const eventsByMonth = {};
  sortedEvents.forEach(e => {
    const date = new Date(e.start_date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!eventsByMonth[key]) eventsByMonth[key] = [];
    eventsByMonth[key].push(e);
  });

  let html = '';
  Object.entries(eventsByMonth).forEach(([key, events]) => {
    const [year, month] = key.split('-').map(Number);
    html += `
      <div class="events-month-group">
        <h3 class="month-header">${HEBREW_MONTHS[month]} ${year}</h3>
        <div class="events-month-list">
          ${events.map(e => renderEventListItem(e)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderEventListItem(event) {
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.general;
  const date = new Date(event.start_date);
  const statusClass = event.status === 'cancelled' ? 'cancelled' : '';

  return `
    <div class="event-list-item ${statusClass}" onclick="viewEvent(${event.id})">
      <div class="event-date-col">
        <span class="event-day">${date.getDate()}</span>
        <span class="event-weekday">${getHebrewWeekday(date)}</span>
      </div>
      <div class="event-type-badge" style="background: ${type.color}">
        ${type.icon}
      </div>
      <div class="event-info-col">
        <div class="event-title">${event.title}</div>
        <div class="event-meta">
          <span>🕐 ${formatTime(event.start_date)}</span>
          ${event.location ? `<span>📍 ${event.location}</span>` : ''}
          ${event.registration_required ? `<span>👥 ${event.current_participants || 0}/${event.max_participants || '∞'}</span>` : ''}
        </div>
      </div>
      <div class="event-status-col">
        <span class="status-badge status-${event.status}">${getStatusLabel(event.status)}</span>
      </div>
    </div>
  `;
}

function renderUpcomingEvents() {
  const container = document.getElementById('upcomingEventsGrid');
  if (!container) return;

  const now = new Date();
  const upcoming = allEvents
    .filter(e => new Date(e.start_date) >= now && e.status === 'published')
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 6);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>אין אירועים קרובים</p>
      </div>
    `;
    return;
  }

  container.innerHTML = upcoming.map(e => {
    const type = EVENT_TYPES[e.event_type] || EVENT_TYPES.general;
    const date = new Date(e.start_date);

    return `
      <div class="upcoming-event-card" onclick="viewEvent(${e.id})" style="border-top: 4px solid ${type.color}">
        <div class="upcoming-event-date">
          <span class="day">${date.getDate()}</span>
          <span class="month">${HEBREW_MONTHS[date.getMonth()].substring(0, 3)}</span>
        </div>
        <div class="upcoming-event-info">
          <div class="upcoming-event-type">${type.icon} ${type.label}</div>
          <div class="upcoming-event-title">${e.title}</div>
          <div class="upcoming-event-time">🕐 ${formatTime(e.start_date)}</div>
          ${e.location ? `<div class="upcoming-event-location">📍 ${e.location}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ==================== Create/Edit Event ====================

function showCreateEventModal(prefilledDate = null) {
  document.getElementById('eventModalTitle').textContent = 'יצירת אירוע חדש';
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';

  // Set default date
  const date = prefilledDate || new Date();
  date.setHours(date.getHours() + 1);
  date.setMinutes(0);
  document.getElementById('eventStartDate').value = formatDateTimeLocal(date);

  // Hide conditional sections
  document.getElementById('registrationOptions').style.display = 'none';
  document.getElementById('recurringEndGroup').style.display = 'none';

  document.getElementById('eventModal').classList.remove('hidden');
}

function showEditEventModal(event) {
  document.getElementById('eventModalTitle').textContent = 'עריכת אירוע';
  document.getElementById('eventId').value = event.id;
  document.getElementById('eventTitle').value = event.title || '';
  document.getElementById('eventType').value = event.event_type || 'general';
  document.getElementById('eventStatus').value = event.status || 'draft';
  document.getElementById('eventStartDate').value = formatDateTimeLocal(new Date(event.start_date));
  document.getElementById('eventEndDate').value = event.end_date ? formatDateTimeLocal(new Date(event.end_date)) : '';
  document.getElementById('eventAllDay').checked = event.all_day === 1;
  document.getElementById('eventLocation').value = event.location || '';
  document.getElementById('eventDescription').value = event.description || '';

  // Registration options
  document.getElementById('eventRegistrationRequired').checked = event.registration_required === 1;
  toggleRegistration();
  document.getElementById('eventMaxParticipants').value = event.max_participants || '';
  document.getElementById('eventRegistrationDeadline').value = event.registration_deadline ? formatDateTimeLocal(new Date(event.registration_deadline)) : '';
  document.getElementById('eventCost').value = event.cost || '';

  // Recurring options
  document.getElementById('eventRecurring').value = event.recurring || 'none';
  toggleRecurring();
  document.getElementById('eventRecurringEnd').value = event.recurring_end_date ? event.recurring_end_date.split('T')[0] : '';

  document.getElementById('eventModal').classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
}

function toggleAllDay() {
  const isAllDay = document.getElementById('eventAllDay').checked;
  const startInput = document.getElementById('eventStartDate');
  const endInput = document.getElementById('eventEndDate');

  if (isAllDay) {
    startInput.type = 'date';
    endInput.type = 'date';
  } else {
    startInput.type = 'datetime-local';
    endInput.type = 'datetime-local';
  }
}

function toggleRegistration() {
  const required = document.getElementById('eventRegistrationRequired').checked;
  document.getElementById('registrationOptions').style.display = required ? 'block' : 'none';
}

function toggleRecurring() {
  const recurring = document.getElementById('eventRecurring').value;
  document.getElementById('recurringEndGroup').style.display = recurring !== 'none' ? 'block' : 'none';
}

async function saveEvent(e) {
  e.preventDefault();

  const eventId = document.getElementById('eventId').value;
  const isEdit = !!eventId;

  const eventData = {
    title: document.getElementById('eventTitle').value,
    event_type: document.getElementById('eventType').value,
    status: document.getElementById('eventStatus').value,
    start_date: document.getElementById('eventStartDate').value,
    end_date: document.getElementById('eventEndDate').value || null,
    all_day: document.getElementById('eventAllDay').checked ? 1 : 0,
    location: document.getElementById('eventLocation').value || null,
    description: document.getElementById('eventDescription').value || null,
    registration_required: document.getElementById('eventRegistrationRequired').checked ? 1 : 0,
    max_participants: parseInt(document.getElementById('eventMaxParticipants').value) || null,
    registration_deadline: document.getElementById('eventRegistrationDeadline').value || null,
    cost: parseFloat(document.getElementById('eventCost').value) || 0,
    recurring: document.getElementById('eventRecurring').value,
    recurring_end_date: document.getElementById('eventRecurringEnd').value || null
  };

  try {
    const url = isEdit ? `${API_BASE}/events/${eventId}` : `${API_BASE}/events`;
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    if (response.ok) {
      showToast(isEdit ? 'האירוע עודכן בהצלחה' : 'האירוע נוצר בהצלחה', 'success');
      closeEventModal();
      loadEvents();
    } else {
      const error = await response.json();
      showToast(error.message || 'שגיאה בשמירת האירוע', 'error');
    }
  } catch (error) {
    console.error('Save event error:', error);
    showToast('שגיאה בשמירת האירוע', 'error');
  }
}

// ==================== View Event ====================

async function viewEvent(id) {
  currentViewEventId = id;
  const event = allEvents.find(e => e.id === id);

  if (!event) {
    try {
      const response = await fetch(`${API_BASE}/events/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const fetchedEvent = await response.json();
        showViewEventModal(fetchedEvent);
      } else {
        showToast('האירוע לא נמצא', 'error');
      }
    } catch (error) {
      showToast('שגיאה בטעינת האירוע', 'error');
    }
  } else {
    showViewEventModal(event);
  }
}

function showViewEventModal(event) {
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.general;
  const startDate = new Date(event.start_date);

  document.getElementById('viewEventTitle').innerHTML = `${type.icon} ${event.title}`;

  document.getElementById('viewEventContent').innerHTML = `
    <div class="view-event-details">
      <div class="view-event-header" style="border-right: 4px solid ${type.color}">
        <div class="view-event-type">${type.label}</div>
        <span class="status-badge status-${event.status}">${getStatusLabel(event.status)}</span>
      </div>

      <div class="view-event-info-grid">
        <div class="info-item">
          <span class="info-label">📅 תאריך</span>
          <span class="info-value">${formatDate(event.start_date)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">🕐 שעה</span>
          <span class="info-value">${event.all_day ? 'כל היום' : formatTime(event.start_date)}${event.end_date && !event.all_day ? ' - ' + formatTime(event.end_date) : ''}</span>
        </div>
        ${event.location ? `
          <div class="info-item">
            <span class="info-label">📍 מיקום</span>
            <span class="info-value">${event.location}</span>
          </div>
        ` : ''}
        ${event.registration_required ? `
          <div class="info-item">
            <span class="info-label">👥 משתתפים</span>
            <span class="info-value">${event.current_participants || 0}${event.max_participants ? ' / ' + event.max_participants : ''}</span>
          </div>
        ` : ''}
        ${event.cost > 0 ? `
          <div class="info-item">
            <span class="info-label">💰 עלות</span>
            <span class="info-value">₪${event.cost}</span>
          </div>
        ` : ''}
        ${event.recurring && event.recurring !== 'none' ? `
          <div class="info-item">
            <span class="info-label">🔄 חזרתיות</span>
            <span class="info-value">${getRecurringLabel(event.recurring)}</span>
          </div>
        ` : ''}
      </div>

      ${event.description ? `
        <div class="view-event-description">
          <h4>תיאור</h4>
          <p>${event.description}</p>
        </div>
      ` : ''}

      ${event.registration_required && event.registrations ? `
        <div class="view-event-registrations">
          <h4>רשומים (${event.registrations.length})</h4>
          <div class="registrations-list">
            ${event.registrations.map(r => `
              <div class="registration-item">
                <span class="reg-name">${r.guest_name || r.user_name}</span>
                <span class="reg-count">${r.num_guests > 1 ? `+${r.num_guests - 1}` : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('viewEventModal').classList.remove('hidden');
}

function closeViewEventModal() {
  document.getElementById('viewEventModal').classList.add('hidden');
  currentViewEventId = null;
}

function editEventFromView() {
  const event = allEvents.find(e => e.id === currentViewEventId);
  if (event) {
    closeViewEventModal();
    showEditEventModal(event);
  }
}

async function deleteEventFromView() {
  if (!confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) return;

  try {
    const response = await fetch(`${API_BASE}/events/${currentViewEventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('האירוע נמחק בהצלחה', 'success');
      closeViewEventModal();
      loadEvents();
    } else {
      showToast('שגיאה במחיקת האירוע', 'error');
    }
  } catch (error) {
    showToast('שגיאה במחיקת האירוע', 'error');
  }
}

// ==================== Utilities ====================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
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

function formatDateTimeLocal(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function getHebrewWeekday(date) {
  const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return weekdays[date.getDay()];
}

function getStatusLabel(status) {
  const labels = {
    draft: 'טיוטה',
    published: 'פורסם',
    cancelled: 'בוטל',
    completed: 'הסתיים'
  };
  return labels[status] || status;
}

function getRecurringLabel(recurring) {
  const labels = {
    none: 'חד פעמי',
    daily: 'יומי',
    weekly: 'שבועי',
    monthly: 'חודשי',
    yearly: 'שנתי'
  };
  return labels[recurring] || recurring;
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
window.showCreateEventModal = showCreateEventModal;
window.closeEventModal = closeEventModal;
window.closeViewEventModal = closeViewEventModal;
window.saveEvent = saveEvent;
window.viewEvent = viewEvent;
window.editEventFromView = editEventFromView;
window.deleteEventFromView = deleteEventFromView;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.showDayEvents = showDayEvents;
window.changeViewMode = changeViewMode;
window.filterEvents = filterEvents;
window.toggleAllDay = toggleAllDay;
window.toggleRegistration = toggleRegistration;
window.toggleRecurring = toggleRecurring;
window.toggleSidebar = toggleSidebar;
