// Budget Management Module for Meitzad Management System
// Uses API instead of Firebase

const Budget = {
  charts: {},
  currentPeriod: 'month',
  transactionsPerPage: 20,
  currentPage: 1,

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addBtn = document.getElementById('add-transaction-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddTransactionModal());
    }

    document.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        const reportType = card.dataset.report;
        this.generateReport(reportType);
      });
    });
  },

  async load() {
    Utils.showLoading();

    try {
      await Promise.all([
        this.loadSummary(),
        this.loadLineChart(),
        this.loadRecentTransactions()
      ]);
    } catch (error) {
      console.error('Budget load error:', error);
      Utils.toast('שגיאה בטעינת נתוני תקציב', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadSummary() {
    try {
      const summary = await API.get('/api/budget/summary');

      document.getElementById('total-income').textContent = Utils.formatCurrency(summary.income || 0);
      document.getElementById('total-expenses').textContent = Utils.formatCurrency(summary.expense || 0);
      document.getElementById('total-balance').textContent = Utils.formatCurrency(summary.balance || 0);

      const balanceEl = document.getElementById('total-balance');
      if (summary.balance >= 0) {
        balanceEl.style.color = 'var(--success-600)';
      } else {
        balanceEl.style.color = 'var(--error-600)';
      }

    } catch (error) {
      console.error('Error loading budget summary:', error);
    }
  },

  async loadLineChart() {
    const canvas = document.getElementById('budget-line-chart');
    if (!canvas) return;

    try {
      const monthlyData = await API.get('/api/budget/monthly');

      const months = [];
      const incomeData = [];
      const expensesData = [];

      // Fill in all 12 months, even if no data
      const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

      // Get last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');

        months.push(hebrewMonths[date.getMonth()]);

        const monthData = monthlyData.find(m => m.month === monthNum) || { income: 0, expense: 0 };
        incomeData.push(monthData.income || 0);
        expensesData.push(monthData.expense || 0);
      }

      if (this.charts.line) {
        this.charts.line.destroy();
      }

      this.charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'הכנסות',
              data: incomeData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'הוצאות',
              data: expensesData,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              rtl: true,
              labels: {
                font: { family: 'Heebo' },
                usePointStyle: true
              }
            },
            tooltip: {
              rtl: true,
              callbacks: {
                label: (context) => ` ${context.dataset.label}: ${Utils.formatCurrency(context.raw)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => Utils.formatCurrency(value)
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });

    } catch (error) {
      console.error('Error loading budget chart:', error);
    }
  },

  async loadRecentTransactions() {
    const tbody = document.getElementById('transactions-body');
    if (!tbody) return;

    try {
      const transactions = await API.get(`/api/budget/transactions?limit=${this.transactionsPerPage}`);

      if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state small">
              <span class="material-symbols-rounded">receipt_long</span>
              <p>אין תנועות להצגה</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = transactions.map(tx => `
        <tr>
          <td>${Utils.formatDate(new Date(tx.date).getTime())}</td>
          <td>${tx.description}</td>
          <td>
            <span class="transaction-category">${Utils.getCategoryLabel(tx.category)}</span>
          </td>
          <td>
            <span class="transaction-amount ${tx.type}">
              ${tx.type === 'income' ? '+' : '-'}${Utils.formatCurrency(tx.amount)}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn edit" onclick="Budget.editTransaction('${tx.id}')" title="עריכה">
                <span class="material-symbols-rounded">edit</span>
              </button>
              <button class="table-action-btn delete" onclick="Budget.deleteTransaction('${tx.id}')" title="מחיקה">
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Error loading transactions:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state small">
            <span class="material-symbols-rounded">error</span>
            <p>שגיאה בטעינת תנועות</p>
          </td>
        </tr>
      `;
    }
  },

  showAddTransactionModal(transaction = null) {
    const isEdit = !!transaction;

    const content = `
      <form id="transaction-form" class="modal-form">
        <div class="form-group">
          <label>סוג תנועה *</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="type" value="income" ${!isEdit || transaction?.type === 'income' ? 'checked' : ''}>
              <span class="radio-custom"></span>
              הכנסה
            </label>
            <label class="radio-label">
              <input type="radio" name="type" value="expense" ${transaction?.type === 'expense' ? 'checked' : ''}>
              <span class="radio-custom"></span>
              הוצאה
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="tx-date">תאריך *</label>
          <input type="date" id="tx-date" name="date" required
            value="${transaction ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
        </div>

        <div class="form-group">
          <label for="tx-amount">סכום (₪) *</label>
          <input type="number" id="tx-amount" name="amount" required min="0" step="0.01"
            value="${transaction?.amount || ''}" placeholder="0">
        </div>

        <div class="form-group">
          <label for="tx-category">קטגוריה *</label>
          <select id="tx-category" name="category" required>
            <option value="">בחרו קטגוריה</option>
            <option value="infrastructure" ${transaction?.category === 'infrastructure' ? 'selected' : ''}>תשתיות</option>
            <option value="maintenance" ${transaction?.category === 'maintenance' ? 'selected' : ''}>תחזוקה</option>
            <option value="security" ${transaction?.category === 'security' ? 'selected' : ''}>ביטחון</option>
            <option value="education" ${transaction?.category === 'education' ? 'selected' : ''}>חינוך</option>
            <option value="welfare" ${transaction?.category === 'welfare' ? 'selected' : ''}>רווחה</option>
            <option value="employees" ${transaction?.category === 'employees' ? 'selected' : ''}>עובדים</option>
            <option value="taxes" ${transaction?.category === 'taxes' ? 'selected' : ''}>מיסים ואגרות</option>
            <option value="other" ${transaction?.category === 'other' ? 'selected' : ''}>אחר</option>
          </select>
        </div>

        <div class="form-group">
          <label for="tx-description">תיאור *</label>
          <input type="text" id="tx-description" name="description" required
            value="${transaction?.description || ''}" placeholder="תיאור התנועה">
        </div>

        <div class="form-group">
          <label for="tx-notes">הערות</label>
          <textarea id="tx-notes" name="notes" rows="3"
            placeholder="הערות נוספות (אופציונלי)">${transaction?.notes || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      <button class="btn btn-primary" onclick="Budget.saveTransaction('${transaction?.id || ''}')">${isEdit ? 'שמור שינויים' : 'הוסף תנועה'}</button>
    `;

    Utils.openModal(isEdit ? 'עריכת תנועה' : 'תנועה חדשה', content, footer);
  },

  async saveTransaction(existingId = '') {
    const form = document.getElementById('transaction-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const data = {
      type: formData.get('type'),
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      description: formData.get('description'),
      notes: formData.get('notes') || ''
    };

    try {
      if (existingId) {
        await API.put(`/api/budget/transactions/${existingId}`, data);
        Utils.toast('התנועה עודכנה בהצלחה', 'success');
      } else {
        await API.post('/api/budget/transactions', data);
        Utils.toast('התנועה נוספה בהצלחה', 'success');
      }

      Utils.closeModal();
      this.load();

    } catch (error) {
      console.error('Error saving transaction:', error);
      Utils.toast('שגיאה בשמירת התנועה', 'error');
    }
  },

  async editTransaction(id) {
    try {
      const transaction = await API.get(`/api/budget/transactions/${id}`);

      if (transaction) {
        this.showAddTransactionModal({ id, ...transaction });
      } else {
        Utils.toast('התנועה לא נמצאה', 'error');
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
      Utils.toast('שגיאה בטעינת התנועה', 'error');
    }
  },

  deleteTransaction(id) {
    Utils.confirm(
      'מחיקת תנועה',
      'האם אתה בטוח שברצונך למחוק תנועה זו? פעולה זו לא ניתנת לביטול.',
      async () => {
        try {
          await API.delete(`/api/budget/transactions/${id}`);
          Utils.toast('התנועה נמחקה', 'success');
          this.load();
        } catch (error) {
          console.error('Error deleting transaction:', error);
          Utils.toast('שגיאה במחיקת התנועה', 'error');
        }
      },
      'מחק',
      'ביטול'
    );
  },

  generateReport(type) {
    const typeLabels = {
      monthly: 'חודשי',
      quarterly: 'רבעוני',
      annual: 'שנתי',
      custom: 'מותאם'
    };

    Utils.toast(`מייצר דוח ${typeLabels[type] || type}...`, 'info');

    setTimeout(() => {
      Utils.toast('תכונת הדוחות תהיה זמינה בקרוב', 'warning');
    }, 1500);
  },

  cleanup() {
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};
  }
};

// Add CSS for radio buttons
const radioStyles = document.createElement('style');
radioStyles.textContent = `
  .radio-group {
    display: flex;
    gap: var(--space-4);
  }
  .radio-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-weight: var(--font-medium);
  }
  .radio-label input[type="radio"] {
    display: none;
  }
  .radio-custom {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border-secondary);
    border-radius: 50%;
    position: relative;
    transition: all var(--transition-fast);
  }
  .radio-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    width: 10px;
    height: 10px;
    background: var(--primary-600);
    border-radius: 50%;
    transition: transform var(--transition-fast);
  }
  .radio-label input[type="radio"]:checked + .radio-custom {
    border-color: var(--primary-600);
  }
  .radio-label input[type="radio"]:checked + .radio-custom::after {
    transform: translate(-50%, -50%) scale(1);
  }
`;
document.head.appendChild(radioStyles);

window.Budget = Budget;
