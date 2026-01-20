// Dashboard Module for Meitzad Management System

const Dashboard = {
  charts: {},
  listeners: [],

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Add any dashboard-specific event listeners here
  },

  async load() {
    Utils.showLoading();

    try {
      await Promise.all([
        this.loadStats(),
        this.loadRecentInquiries(),
        this.loadUpcomingMeetings(),
        this.loadBudgetChart()
      ]);
    } catch (error) {
      console.error('Dashboard load error:', error);
      Utils.toast('שגיאה בטעינת נתונים', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadStats() {
    // Load budget balance
    try {
      const budgetSnapshot = await firebaseDB.ref('budget/summary').once('value');
      const budgetData = budgetSnapshot.val() || {};
      const balance = (budgetData.income || 0) - (budgetData.expenses || 0);

      document.getElementById('stat-budget').textContent = Utils.formatCurrency(balance);
    } catch (error) {
      console.error('Error loading budget stats:', error);
    }

    // Load open inquiries count
    try {
      const inquiriesSnapshot = await firebaseDB.ref('inquiries')
        .orderByChild('status')
        .equalTo('new')
        .once('value');

      const openCount = inquiriesSnapshot.numChildren();
      document.getElementById('stat-open-inquiries').textContent = openCount;

      // Update badge
      Navigation.updateInquiriesBadge(openCount);
    } catch (error) {
      console.error('Error loading inquiries stats:', error);
    }

    // Load next meeting
    try {
      const now = Date.now();
      const meetingsSnapshot = await firebaseDB.ref('meetings')
        .orderByChild('date')
        .startAt(now)
        .limitToFirst(1)
        .once('value');

      const meetings = meetingsSnapshot.val();
      if (meetings) {
        const nextMeeting = Object.values(meetings)[0];
        const meetingDate = new Date(nextMeeting.date);
        document.getElementById('stat-next-meeting').textContent =
          `${meetingDate.getDate()}/${meetingDate.getMonth() + 1}`;
      } else {
        document.getElementById('stat-next-meeting').textContent = '--';
      }
    } catch (error) {
      console.error('Error loading meeting stats:', error);
    }

    // Load active employees count
    try {
      const employeesSnapshot = await firebaseDB.ref('employees')
        .orderByChild('status')
        .equalTo('active')
        .once('value');

      document.getElementById('stat-employees').textContent = employeesSnapshot.numChildren();
    } catch (error) {
      console.error('Error loading employees stats:', error);
    }
  },

  async loadRecentInquiries() {
    const container = document.getElementById('recent-inquiries');
    if (!container) return;

    try {
      const snapshot = await firebaseDB.ref('inquiries')
        .orderByChild('createdAt')
        .limitToLast(5)
        .once('value');

      const inquiries = snapshot.val();

      if (!inquiries || Object.keys(inquiries).length === 0) {
        container.innerHTML = `
          <div class="empty-state small">
            <span class="material-symbols-rounded">inbox</span>
            <p>אין פניות חדשות</p>
          </div>
        `;
        return;
      }

      // Convert to array and sort by date (newest first)
      const inquiriesArray = Object.entries(inquiries)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.createdAt - a.createdAt);

      container.innerHTML = inquiriesArray.map(inquiry => `
        <div class="inquiry-item" data-id="${inquiry.id}">
          <div class="inquiry-item-icon">
            <span class="material-symbols-rounded">mail</span>
          </div>
          <div class="inquiry-item-content">
            <div class="inquiry-item-title">${Utils.truncate(inquiry.subject, 40)}</div>
            <div class="inquiry-item-meta">
              ${inquiry.name} | ${Utils.formatRelativeTime(inquiry.createdAt)}
            </div>
          </div>
          <span class="status-badge status-${inquiry.status}">${Utils.getStatusLabel(inquiry.status)}</span>
        </div>
      `).join('');

      // Add click handlers
      container.querySelectorAll('.inquiry-item').forEach(item => {
        item.addEventListener('click', () => {
          Navigation.navigateTo('inquiries');
          // TODO: Open specific inquiry
        });
      });

    } catch (error) {
      console.error('Error loading recent inquiries:', error);
      container.innerHTML = `
        <div class="empty-state small">
          <span class="material-symbols-rounded">error</span>
          <p>שגיאה בטעינת פניות</p>
        </div>
      `;
    }
  },

  async loadUpcomingMeetings() {
    const container = document.getElementById('upcoming-meetings');
    if (!container) return;

    try {
      const now = Date.now();
      const snapshot = await firebaseDB.ref('meetings')
        .orderByChild('date')
        .startAt(now)
        .limitToFirst(3)
        .once('value');

      const meetings = snapshot.val();

      if (!meetings || Object.keys(meetings).length === 0) {
        container.innerHTML = `
          <div class="empty-state small">
            <span class="material-symbols-rounded">event_busy</span>
            <p>אין ישיבות מתוכננות</p>
          </div>
        `;
        return;
      }

      const meetingsArray = Object.entries(meetings)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => a.date - b.date);

      container.innerHTML = meetingsArray.map(meeting => {
        const date = new Date(meeting.date);
        const day = date.getDate();
        const month = Utils.getHebrewMonth(date.getMonth());

        return `
          <div class="meeting-item" data-id="${meeting.id}">
            <div class="meeting-item-date">
              <span class="meeting-item-day">${day}</span>
              <span class="meeting-item-month">${month.slice(0, 3)}</span>
            </div>
            <div class="meeting-item-content">
              <div class="meeting-item-title">${meeting.title}</div>
              <div class="meeting-item-time">
                <span class="material-symbols-rounded">schedule</span>
                ${Utils.formatTime(meeting.date)}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers
      container.querySelectorAll('.meeting-item').forEach(item => {
        item.addEventListener('click', () => {
          Navigation.navigateTo('meetings');
          // TODO: Open specific meeting
        });
      });

    } catch (error) {
      console.error('Error loading upcoming meetings:', error);
      container.innerHTML = `
        <div class="empty-state small">
          <span class="material-symbols-rounded">error</span>
          <p>שגיאה בטעינת ישיבות</p>
        </div>
      `;
    }
  },

  async loadBudgetChart() {
    const canvas = document.getElementById('budget-pie-chart');
    if (!canvas) return;

    try {
      const snapshot = await firebaseDB.ref('budget/categories').once('value');
      const categories = snapshot.val() || {};

      // Prepare data for chart
      const labels = [];
      const data = [];
      const colors = [
        '#3d6fc1', '#2ea1b3', '#f59e0b', '#10b981',
        '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'
      ];

      Object.entries(categories).forEach(([key, value]) => {
        labels.push(Utils.getCategoryLabel(key));
        data.push(value.total || 0);
      });

      // If no data, show placeholder
      if (data.length === 0 || data.every(d => d === 0)) {
        labels.push('אין נתונים');
        data.push(1);
      }

      // Destroy existing chart if exists
      if (this.charts.budgetPie) {
        this.charts.budgetPie.destroy();
      }

      // Create new chart
      this.charts.budgetPie = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors.slice(0, data.length),
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              rtl: true,
              labels: {
                font: {
                  family: 'Heebo',
                  size: 12
                },
                padding: 15,
                usePointStyle: true
              }
            },
            tooltip: {
              rtl: true,
              callbacks: {
                label: (context) => {
                  const value = context.raw;
                  return ` ${context.label}: ${Utils.formatCurrency(value)}`;
                }
              }
            }
          },
          cutout: '60%'
        }
      });

    } catch (error) {
      console.error('Error loading budget chart:', error);
    }
  },

  // Cleanup when leaving dashboard
  cleanup() {
    // Remove any listeners
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];

    // Destroy charts
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};
  }
};

// Make Dashboard globally available
window.Dashboard = Dashboard;
