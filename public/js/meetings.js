// Meetings Module for Meitzad Management System
// Uses API instead of Firebase

const Meetings = {
  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addBtn = document.getElementById('add-meeting-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddMeetingModal());
    }
  },

  async load() {
    Utils.showLoading();
    try {
      await Promise.all([
        this.loadUpcomingMeetings(),
        this.loadPastMeetings(),
        this.loadProtocols()
      ]);
    } catch (error) {
      console.error('Meetings load error:', error);
      Utils.toast('שגיאה בטעינת ישיבות', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadUpcomingMeetings() {
    const container = document.getElementById('upcoming-meetings-grid');
    if (!container) return;

    try {
      const meetings = await API.get('/api/meetings?upcoming=true');

      if (!meetings || meetings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">event_busy</span>
            <p>אין ישיבות מתוכננות</p>
          </div>
        `;
        return;
      }

      container.innerHTML = meetings.map(meeting => this.renderMeetingCard(meeting)).join('');

    } catch (error) {
      console.error('Error loading upcoming meetings:', error);
    }
  },

  async loadPastMeetings() {
    const container = document.getElementById('past-meetings-grid');
    if (!container) return;

    try {
      const allMeetings = await API.get('/api/meetings');
      const now = new Date();
      const meetings = (allMeetings || []).filter(m => new Date(m.date) < now).slice(0, 20);

      if (!meetings || meetings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">history</span>
            <p>אין ישיבות קודמות</p>
          </div>
        `;
        return;
      }

      container.innerHTML = meetings.map(meeting => this.renderMeetingCard(meeting, true)).join('');

    } catch (error) {
      console.error('Error loading past meetings:', error);
    }
  },

  async loadProtocols() {
    const tbody = document.getElementById('protocols-body');
    if (!tbody) return;

    try {
      const protocols = await API.get('/api/meetings/protocols/all');

      if (!protocols || protocols.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state small">
              <span class="material-symbols-rounded">description</span>
              <p>אין פרוטוקולים</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = protocols.map(protocol => `
        <tr>
          <td>${protocol.meeting_date ? Utils.formatDate(new Date(protocol.meeting_date).getTime()) : '-'}</td>
          <td>${protocol.meeting_type || 'ישיבת וועד'}</td>
          <td>${protocol.participants || '-'}</td>
          <td><span class="status-badge status-${protocol.status}">${protocol.status === 'ready' ? 'מוכן' : protocol.status === 'approved' ? 'מאושר' : 'בעיבוד'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn view" onclick="Meetings.viewProtocol('${protocol.id}')" title="צפייה">
                <span class="material-symbols-rounded">visibility</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Error loading protocols:', error);
    }
  },

  renderMeetingCard(meeting, isPast = false) {
    const date = new Date(meeting.date);
    const day = date.getDate();
    const month = Utils.getHebrewMonth(date.getMonth());

    return `
      <div class="meeting-card" onclick="Meetings.viewMeeting('${meeting.id}')">
        <div class="meeting-card-header">
          <div class="meeting-card-date">
            <span class="day">${day}</span>
            <span class="month">${month.slice(0, 3)}</span>
          </div>
          <div class="meeting-card-info">
            <h4 class="meeting-card-title">${meeting.title}</h4>
            <div class="meeting-card-time">
              <span class="material-symbols-rounded">schedule</span>
              ${Utils.formatTime(date.getTime())}
            </div>
          </div>
        </div>
        ${meeting.agenda ? `<div class="meeting-card-body"><p class="meeting-card-agenda">${Utils.truncate(meeting.agenda, 100)}</p></div>` : ''}
        <div class="meeting-card-footer">
          <div class="meeting-card-participants">
            ${meeting.participants ? `<span class="participant-count">${meeting.participants} משתתפים</span>` : ''}
          </div>
          ${isPast && meeting.has_protocol ? '<span class="status-badge status-completed">יש פרוטוקול</span>' : ''}
        </div>
      </div>
    `;
  },

  showAddMeetingModal(meeting = null) {
    const isEdit = !!meeting;

    const content = `
      <form id="meeting-form">
        <div class="form-group">
          <label for="meeting-title">כותרת *</label>
          <input type="text" id="meeting-title" name="title" required value="${meeting?.title || ''}" placeholder="ישיבת וועד רגילה">
        </div>
        <div class="form-group">
          <label for="meeting-date">תאריך ושעה *</label>
          <input type="datetime-local" id="meeting-date" name="date" required
            value="${meeting ? new Date(meeting.date).toISOString().slice(0, 16) : ''}">
        </div>
        <div class="form-group">
          <label for="meeting-location">מיקום</label>
          <input type="text" id="meeting-location" name="location" value="${meeting?.location || ''}" placeholder="חדר ישיבות">
        </div>
        <div class="form-group">
          <label for="meeting-type">סוג ישיבה</label>
          <select id="meeting-type" name="type">
            <option value="regular" ${meeting?.type === 'regular' ? 'selected' : ''}>ישיבה רגילה</option>
            <option value="emergency" ${meeting?.type === 'emergency' ? 'selected' : ''}>ישיבה דחופה</option>
            <option value="annual" ${meeting?.type === 'annual' ? 'selected' : ''}>אסיפה שנתית</option>
            <option value="special" ${meeting?.type === 'special' ? 'selected' : ''}>ישיבה מיוחדת</option>
          </select>
        </div>
        <div class="form-group">
          <label for="meeting-agenda">סדר יום</label>
          <textarea id="meeting-agenda" name="agenda" rows="4" placeholder="פרטו את נושאי הדיון">${meeting?.agenda || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      <button class="btn btn-primary" onclick="Meetings.saveMeeting('${meeting?.id || ''}')">${isEdit ? 'שמור שינויים' : 'צור ישיבה'}</button>
    `;

    Utils.openModal(isEdit ? 'עריכת ישיבה' : 'ישיבה חדשה', content, footer);
  },

  async saveMeeting(existingId = '') {
    const form = document.getElementById('meeting-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const data = {
      title: formData.get('title'),
      date: formData.get('date'),
      location: formData.get('location'),
      type: formData.get('type'),
      agenda: formData.get('agenda')
    };

    try {
      if (existingId) {
        await API.put(`/api/meetings/${existingId}`, data);
        Utils.toast('הישיבה עודכנה', 'success');
      } else {
        await API.post('/api/meetings', data);
        Utils.toast('הישיבה נוצרה', 'success');
      }

      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error saving meeting:', error);
      Utils.toast('שגיאה בשמירת הישיבה', 'error');
    }
  },

  async viewMeeting(id) {
    try {
      const meeting = await API.get(`/api/meetings/${id}`);

      if (!meeting) {
        Utils.toast('הישיבה לא נמצאה', 'error');
        return;
      }

      const date = new Date(meeting.date);
      const content = `
        <div class="meeting-detail">
          <div class="detail-row">
            <span class="detail-label">תאריך:</span>
            <span class="detail-value">${Utils.formatDate(date.getTime(), 'full')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">שעה:</span>
            <span class="detail-value">${Utils.formatTime(date.getTime())}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">מיקום:</span>
            <span class="detail-value">${meeting.location || 'לא צוין'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">סוג:</span>
            <span class="detail-value">${meeting.type === 'regular' ? 'ישיבה רגילה' : meeting.type === 'emergency' ? 'ישיבה דחופה' : meeting.type === 'annual' ? 'אסיפה שנתית' : 'ישיבה מיוחדת'}</span>
          </div>
          ${meeting.agenda ? `
            <div class="detail-row full">
              <span class="detail-label">סדר יום:</span>
              <div class="detail-value" style="white-space: pre-wrap;">${meeting.agenda}</div>
            </div>
          ` : ''}
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">סגור</button>
        <button class="btn btn-primary" onclick="Meetings.editMeeting('${id}')">עריכה</button>
      `;

      Utils.openModal(meeting.title, content, footer);

    } catch (error) {
      console.error('Error viewing meeting:', error);
      Utils.toast('שגיאה בטעינת הישיבה', 'error');
    }
  },

  async editMeeting(id) {
    try {
      const meeting = await API.get(`/api/meetings/${id}`);

      if (!meeting) {
        Utils.toast('הישיבה לא נמצאה', 'error');
        return;
      }

      Utils.closeModal();
      setTimeout(() => {
        this.showAddMeetingModal({ id, ...meeting });
      }, 300);

    } catch (error) {
      console.error('Error editing meeting:', error);
      Utils.toast('שגיאה בטעינת הישיבה', 'error');
    }
  },

  async viewProtocol(id) {
    try {
      const protocol = await API.get(`/api/meetings/protocols/${id}`);

      if (!protocol) {
        Utils.toast('הפרוטוקול לא נמצא', 'error');
        return;
      }

      const content = `
        <div class="protocol-detail">
          <div class="detail-row">
            <span class="detail-label">תאריך:</span>
            <span class="detail-value">${protocol.meeting_date ? Utils.formatDate(new Date(protocol.meeting_date).getTime()) : '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">סוג ישיבה:</span>
            <span class="detail-value">${protocol.meeting_type || 'ישיבת וועד'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">משתתפים:</span>
            <span class="detail-value">${protocol.participants || '-'}</span>
          </div>
          <div class="detail-row full">
            <span class="detail-label">תוכן:</span>
            <div class="detail-value" style="white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${protocol.content || 'אין תוכן'}</div>
          </div>
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">סגור</button>
      `;

      Utils.openModal('פרוטוקול', content, footer);

    } catch (error) {
      console.error('Error viewing protocol:', error);
      Utils.toast('שגיאה בטעינת הפרוטוקול', 'error');
    }
  },

  cleanup() {}
};

window.Meetings = Meetings;
