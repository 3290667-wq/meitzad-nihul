// Meetings Module for Meitzad Management System

const Meetings = {
  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addBtn = document.getElementById('add-meeting-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddMeetingModal());
    }

    // Protocol upload zone
    const uploadZone = document.getElementById('protocol-upload-zone');
    const fileInput = document.getElementById('protocol-file-input');

    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click());
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      });
      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
      });
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) this.handleProtocolUpload(files[0]);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) this.handleProtocolUpload(e.target.files[0]);
      });
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
      const now = Date.now();
      const snapshot = await firebaseDB.ref('meetings')
        .orderByChild('date')
        .startAt(now)
        .once('value');

      const meetings = snapshot.val();

      if (!meetings) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">event_busy</span>
            <p>אין ישיבות מתוכננות</p>
          </div>
        `;
        return;
      }

      const meetingsArray = Object.entries(meetings)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => a.date - b.date);

      container.innerHTML = meetingsArray.map(meeting => this.renderMeetingCard(meeting)).join('');

    } catch (error) {
      console.error('Error loading upcoming meetings:', error);
    }
  },

  async loadPastMeetings() {
    const container = document.getElementById('past-meetings-grid');
    if (!container) return;

    try {
      const now = Date.now();
      const snapshot = await firebaseDB.ref('meetings')
        .orderByChild('date')
        .endAt(now)
        .limitToLast(20)
        .once('value');

      const meetings = snapshot.val();

      if (!meetings) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">history</span>
            <p>אין ישיבות קודמות</p>
          </div>
        `;
        return;
      }

      const meetingsArray = Object.entries(meetings)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.date - a.date);

      container.innerHTML = meetingsArray.map(meeting => this.renderMeetingCard(meeting, true)).join('');

    } catch (error) {
      console.error('Error loading past meetings:', error);
    }
  },

  async loadProtocols() {
    const tbody = document.getElementById('protocols-body');
    if (!tbody) return;

    try {
      const snapshot = await firebaseDB.ref('protocols')
        .orderByChild('meetingDate')
        .limitToLast(20)
        .once('value');

      const protocols = snapshot.val();

      if (!protocols) {
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

      const protocolsArray = Object.entries(protocols)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.meetingDate - a.meetingDate);

      tbody.innerHTML = protocolsArray.map(protocol => `
        <tr>
          <td>${Utils.formatDate(protocol.meetingDate)}</td>
          <td>${protocol.meetingType || 'ישיבת וועד'}</td>
          <td>${protocol.participants || '-'}</td>
          <td><span class="status-badge status-${protocol.status}">${protocol.status === 'ready' ? 'מוכן' : 'בעיבוד'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn view" onclick="Meetings.viewProtocol('${protocol.id}')" title="צפייה">
                <span class="material-symbols-rounded">visibility</span>
              </button>
              <button class="table-action-btn" onclick="Meetings.downloadProtocol('${protocol.id}')" title="הורדה">
                <span class="material-symbols-rounded">download</span>
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
              ${Utils.formatTime(meeting.date)}
            </div>
          </div>
        </div>
        ${meeting.agenda ? `<div class="meeting-card-body"><p class="meeting-card-agenda">${Utils.truncate(meeting.agenda, 100)}</p></div>` : ''}
        <div class="meeting-card-footer">
          <div class="meeting-card-participants">
            ${meeting.participants ? `<span class="participant-count">${meeting.participants} משתתפים</span>` : ''}
          </div>
          ${isPast && meeting.hasProtocol ? '<span class="status-badge status-completed">יש פרוטוקול</span>' : ''}
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
      date: new Date(formData.get('date')).getTime(),
      location: formData.get('location'),
      type: formData.get('type'),
      agenda: formData.get('agenda'),
      updatedAt: Date.now(),
      updatedBy: Auth.getUid()
    };

    if (!existingId) {
      data.createdAt = Date.now();
      data.createdBy = Auth.getUid();
    }

    try {
      if (existingId) {
        await firebaseDB.ref(`meetings/${existingId}`).update(data);
        Utils.toast('הישיבה עודכנה', 'success');
      } else {
        await firebaseDB.ref('meetings').push(data);
        Utils.toast('הישיבה נוצרה', 'success');
      }

      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error saving meeting:', error);
      Utils.toast('שגיאה בשמירת הישיבה', 'error');
    }
  },

  viewMeeting(id) {
    // TODO: Show meeting details modal
    Utils.toast('פרטי ישיבה יוצגו בקרוב', 'info');
  },

  viewProtocol(id) {
    Utils.toast('צפייה בפרוטוקול...', 'info');
  },

  downloadProtocol(id) {
    Utils.toast('הורדת פרוטוקול...', 'info');
  },

  handleProtocolUpload(file) {
    Utils.toast(`מעלה קובץ: ${file.name}`, 'info');
    // TODO: Upload file to Firebase Storage
    // TODO: Send to transcription service (Otter.ai, Fireflies.ai)
    setTimeout(() => {
      Utils.toast('העלאת קבצים והמרה לפרוטוקול תהיה זמינה בקרוב', 'warning');
    }, 1500);
  },

  cleanup() {}
};

window.Meetings = Meetings;
