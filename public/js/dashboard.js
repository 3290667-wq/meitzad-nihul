// Dashboard Module for Meitzad Management System
// Uses API instead of Firebase

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
    try {
      const stats = await API.get('/api/dashboard/stats');

      // Update stat cards
      const budgetEl = document.getElementById('stat-budget');
      if (budgetEl) {
        budgetEl.textContent = Utils.formatCurrency(stats.budget?.balance || 0);
      }

      const inquiriesEl = document.getElementById('stat-open-inquiries');
      if (inquiriesEl) {
        inquiriesEl.textContent = stats.inquiries?.open || 0;
        // Update badge
        if (typeof Navigation !== 'undefined' && Navigation.updateInquiriesBadge) {
          Navigation.updateInquiriesBadge(stats.inquiries?.open || 0);
        }
      }

      const meetingsEl = document.getElementById('stat-next-meeting');
      if (meetingsEl) {
        if (stats.meetings?.upcoming > 0) {
          // Fetch next meeting date
          try {
            const upcomingMeetings = await API.get('/api/meetings/upcoming?limit=1');
            if (upcomingMeetings && upcomingMeetings.length > 0) {
              const meetingDate = new Date(upcomingMeetings[0].date);
              meetingsEl.textContent = `${meetingDate.getDate()}/${meetingDate.getMonth() + 1}`;
            } else {
              meetingsEl.textContent = '--';
            }
          } catch {
            meetingsEl.textContent = '--';
          }
        } else {
          meetingsEl.textContent = '--';
        }
      }

      const employeesEl = document.getElementById('stat-employees');
      if (employeesEl) {
        employeesEl.textContent = stats.employees?.active || 0;
      }

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  async loadRecentInquiries() {
    const container = document.getElementById('recent-inquiries');
    if (!container) return;

    try {
      const inquiries = await API.get('/api/inquiries?limit=5');

      if (!inquiries || inquiries.length === 0) {
        container.innerHTML = `
          <div class="empty-state small">
            <span class="material-symbols-rounded">inbox</span>
            <p>אין פניות חדשות</p>
          </div>
        `;
        return;
      }

      container.innerHTML = inquiries.map(inquiry => `
        <div class="inquiry-item" data-id="${inquiry.id}">
          <div class="inquiry-item-icon">
            <span class="material-symbols-rounded">mail</span>
          </div>
          <div class="inquiry-item-content">
            <div class="inquiry-item-title">${Utils.truncate(inquiry.subject, 40)}</div>
            <div class="inquiry-item-meta">
              ${inquiry.name || 'אנונימי'} | ${Utils.formatRelativeTime(new Date(inquiry.created_at).getTime())}
            </div>
          </div>
          <span class="status-badge status-${inquiry.status}">${Utils.getStatusLabel(inquiry.status)}</span>
        </div>
      `).join('');

      // Add click handlers
      container.querySelectorAll('.inquiry-item').forEach(item => {
        item.addEventListener('click', () => {
          Navigation.navigateTo('inquiries');
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
      const meetings = await API.get('/api/meetings/upcoming?limit=3');

      if (!meetings || meetings.length === 0) {
        container.innerHTML = `
          <div class="empty-state small">
            <span class="material-symbols-rounded">event_busy</span>
            <p>אין ישיבות מתוכננות</p>
          </div>
        `;
        return;
      }

      container.innerHTML = meetings.map(meeting => {
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
                ${Utils.formatTime(date.getTime())}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers
      container.querySelectorAll('.meeting-item').forEach(item => {
        item.addEventListener('click', () => {
          Navigation.navigateTo('meetings');
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
      const categoryData = await API.get('/api/budget/by-category?type=expense');

      // Prepare data for chart
      const labels = [];
      const data = [];
      const colors = [
        '#3d6fc1', '#2ea1b3', '#f59e0b', '#10b981',
        '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'
      ];

      if (categoryData && categoryData.length > 0) {
        categoryData.forEach(item => {
          labels.push(Utils.getCategoryLabel(item.category));
          data.push(item.total || 0);
        });
      }

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
