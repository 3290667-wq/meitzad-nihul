// Inquiries Module for Meitzad Management System

const Inquiries = {
  perPage: 20,
  currentPage: 1,
  filters: { status: '', category: '', search: '' },
  listeners: [],

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Search
    const searchInput = document.getElementById('inquiries-search');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        this.filters.search = e.target.value;
        this.loadInquiries();
      }, 300));
    }

    // Category filter
    const categoryFilter = document.getElementById('inquiries-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.loadInquiries();
      });
    }

    // Date filter
    const dateFilter = document.getElementById('inquiries-date-filter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.filters.date = e.target.value;
        this.loadInquiries();
      });
    }

    // Export button
    const exportBtn = document.getElementById('export-inquiries-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportInquiries());
    }
  },

  async load() {
    Utils.showLoading();
    try {
      await this.loadInquiries();
      this.updateBadge();
    } catch (error) {
      console.error('Inquiries load error:', error);
      Utils.toast('שגיאה בטעינת פניות', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadInquiries() {
    const tbody = document.getElementById('inquiries-body');
    if (!tbody) return;

    try {
      const snapshot = await firebaseDB.ref('inquiries')
        .orderByChild('createdAt')
        .limitToLast(100)
        .once('value');

      let inquiries = snapshot.val() || {};

      // Convert to array
      let inquiriesArray = Object.entries(inquiries)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.createdAt - a.createdAt);

      // Apply filters
      if (this.filters.search) {
        const search = this.filters.search.toLowerCase();
        inquiriesArray = inquiriesArray.filter(i =>
          i.subject?.toLowerCase().includes(search) ||
          i.name?.toLowerCase().includes(search) ||
          i.inquiryNumber?.toLowerCase().includes(search)
        );
      }

      if (this.filters.category) {
        inquiriesArray = inquiriesArray.filter(i => i.category === this.filters.category);
      }

      if (this.filters.date) {
        const now = new Date();
        let startDate;
        switch (this.filters.date) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }
        if (startDate) {
          inquiriesArray = inquiriesArray.filter(i => i.createdAt >= startDate.getTime());
        }
      }

      if (inquiriesArray.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state small">
              <span class="material-symbols-rounded">inbox</span>
              <p>אין פניות להצגה</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = inquiriesArray.map(inquiry => `
        <tr onclick="Inquiries.viewInquiry('${inquiry.id}')" style="cursor: pointer;">
          <td><strong>${inquiry.inquiryNumber || 'ללא'}</strong></td>
          <td>${Utils.truncate(inquiry.subject, 40)}</td>
          <td>${inquiry.name || 'אנונימי'}</td>
          <td><span class="transaction-category">${Utils.getCategoryLabel(inquiry.category)}</span></td>
          <td><span class="status-badge status-${inquiry.status}">${Utils.getStatusLabel(inquiry.status)}</span></td>
          <td>${Utils.formatDate(inquiry.createdAt)}</td>
          <td>
            <div class="table-actions" onclick="event.stopPropagation()">
              <button class="table-action-btn view" onclick="Inquiries.viewInquiry('${inquiry.id}')" title="צפייה">
                <span class="material-symbols-rounded">visibility</span>
              </button>
              <button class="table-action-btn edit" onclick="Inquiries.updateStatus('${inquiry.id}')" title="עדכון סטטוס">
                <span class="material-symbols-rounded">edit</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Error loading inquiries:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state small">
            <span class="material-symbols-rounded">error</span>
            <p>שגיאה בטעינת פניות</p>
          </td>
        </tr>
      `;
    }
  },

  async viewInquiry(id) {
    try {
      const snapshot = await firebaseDB.ref(`inquiries/${id}`).once('value');
      const inquiry = snapshot.val();

      if (!inquiry) {
        Utils.toast('פנייה לא נמצאה', 'error');
        return;
      }

      const content = `
        <div class="inquiry-detail">
          <div class="detail-row">
            <span class="detail-label">מספר פנייה:</span>
            <span class="detail-value">${inquiry.inquiryNumber || 'ללא'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">סטטוס:</span>
            <span class="status-badge status-${inquiry.status}">${Utils.getStatusLabel(inquiry.status)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">תאריך פתיחה:</span>
            <span class="detail-value">${Utils.formatDate(inquiry.createdAt, 'full')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">שם פונה:</span>
            <span class="detail-value">${inquiry.name || 'לא צוין'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">אימייל:</span>
            <span class="detail-value">${inquiry.email || 'לא צוין'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">טלפון:</span>
            <span class="detail-value">${inquiry.phone || 'לא צוין'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">קטגוריה:</span>
            <span class="detail-value">${Utils.getCategoryLabel(inquiry.category)}</span>
          </div>
          <div class="detail-row full">
            <span class="detail-label">נושא:</span>
            <span class="detail-value">${inquiry.subject}</span>
          </div>
          <div class="detail-row full">
            <span class="detail-label">תיאור:</span>
            <div class="detail-value description">${inquiry.description || 'אין תיאור'}</div>
          </div>
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">סגור</button>
        <button class="btn btn-primary" onclick="Inquiries.updateStatus('${id}')">עדכון סטטוס</button>
        ${inquiry.phone ? `<button class="btn btn-success" onclick="Utils.sendWhatsAppMessage('${inquiry.phone}', 'שלום, לגבי הפנייה שלך ${inquiry.inquiryNumber}...')">שלח וואטסאפ</button>` : ''}
      `;

      Utils.openModal(`פנייה: ${inquiry.subject}`, content, footer);

    } catch (error) {
      console.error('Error loading inquiry:', error);
      Utils.toast('שגיאה בטעינת הפנייה', 'error');
    }
  },

  async updateStatus(id) {
    try {
      const snapshot = await firebaseDB.ref(`inquiries/${id}`).once('value');
      const inquiry = snapshot.val();

      if (!inquiry) {
        Utils.toast('פנייה לא נמצאה', 'error');
        return;
      }

      const content = `
        <form id="status-form">
          <div class="form-group">
            <label>סטטוס נוכחי</label>
            <span class="status-badge status-${inquiry.status}">${Utils.getStatusLabel(inquiry.status)}</span>
          </div>
          <div class="form-group">
            <label for="new-status">סטטוס חדש *</label>
            <select id="new-status" name="status" required>
              <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>חדש</option>
              <option value="in-progress" ${inquiry.status === 'in-progress' ? 'selected' : ''}>בטיפול</option>
              <option value="pending" ${inquiry.status === 'pending' ? 'selected' : ''}>ממתין</option>
              <option value="resolved" ${inquiry.status === 'resolved' ? 'selected' : ''}>טופל</option>
              <option value="closed" ${inquiry.status === 'closed' ? 'selected' : ''}>סגור</option>
            </select>
          </div>
          <div class="form-group">
            <label for="status-note">הערה</label>
            <textarea id="status-note" name="note" rows="3" placeholder="הערה לעדכון הסטטוס (אופציונלי)"></textarea>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" name="notify" id="notify-citizen" checked>
            <span class="checkmark"></span>
            שלח התראה לפונה
          </label>
        </form>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
        <button class="btn btn-primary" onclick="Inquiries.saveStatus('${id}')">שמור</button>
      `;

      Utils.openModal('עדכון סטטוס פנייה', content, footer);

    } catch (error) {
      console.error('Error:', error);
      Utils.toast('שגיאה', 'error');
    }
  },

  async saveStatus(id) {
    const form = document.getElementById('status-form');
    const status = form.querySelector('#new-status').value;
    const note = form.querySelector('#status-note').value;
    const notify = form.querySelector('#notify-citizen').checked;

    try {
      await firebaseDB.ref(`inquiries/${id}`).update({
        status,
        updatedAt: Date.now(),
        updatedBy: Auth.getUid()
      });

      // Add update to history
      await firebaseDB.ref(`inquiries/${id}/updates`).push({
        status,
        note,
        createdAt: Date.now(),
        createdBy: Auth.getUid()
      });

      if (notify) {
        // TODO: Send notification to citizen (email/WhatsApp)
        console.log('Notification would be sent here');
      }

      Utils.toast('הסטטוס עודכן בהצלחה', 'success');
      Utils.closeModal();
      this.loadInquiries();
      this.updateBadge();

    } catch (error) {
      console.error('Error updating status:', error);
      Utils.toast('שגיאה בעדכון הסטטוס', 'error');
    }
  },

  async updateBadge() {
    try {
      const snapshot = await firebaseDB.ref('inquiries')
        .orderByChild('status')
        .equalTo('new')
        .once('value');

      const count = snapshot.numChildren();
      Navigation.updateInquiriesBadge(count);
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  },

  exportInquiries() {
    Utils.toast('ייצוא פניות...', 'info');
    // TODO: Implement export
  },

  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }
};

// Add detail view styles
const detailStyles = document.createElement('style');
detailStyles.textContent = `
  .inquiry-detail { display: flex; flex-direction: column; gap: var(--space-4); }
  .detail-row { display: flex; gap: var(--space-3); align-items: flex-start; }
  .detail-row.full { flex-direction: column; }
  .detail-label { font-weight: var(--font-semibold); color: var(--color-text-secondary); min-width: 120px; }
  .detail-value { color: var(--color-text-primary); }
  .detail-value.description { background: var(--color-bg-secondary); padding: var(--space-3); border-radius: var(--radius-md); white-space: pre-wrap; }
`;
document.head.appendChild(detailStyles);

window.Inquiries = Inquiries;
