// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let transactions = [];
let budgetAllocations = [];
let currentYear = new Date().getFullYear();
let expensesPieChart = null;
let monthlyTrendChart = null;

// Category translations
const EXPENSE_CATEGORIES = {
  salaries: { name: 'משכורות', icon: '💰', color: '#4CAF50' },
  maintenance: { name: 'תחזוקה', icon: '🔧', color: '#2196F3' },
  utilities: { name: 'חשבונות', icon: '⚡', color: '#FF9800' },
  events: { name: 'אירועים', icon: '🎉', color: '#9C27B0' },
  security: { name: 'ביטחון', icon: '🔒', color: '#F44336' },
  education: { name: 'חינוך', icon: '📚', color: '#00BCD4' },
  infrastructure: { name: 'תשתיות', icon: '🏗️', color: '#795548' },
  other: { name: 'אחר', icon: '📋', color: '#607D8B' }
};

const INCOME_CATEGORIES = {
  taxes: { name: 'ארנונה', icon: '🏠', color: '#4CAF50' },
  fees: { name: 'אגרות', icon: '📝', color: '#2196F3' },
  grants: { name: 'מענקים', icon: '🎁', color: '#FF9800' },
  rentals: { name: 'השכרות', icon: '🏛️', color: '#9C27B0' },
  donations: { name: 'תרומות', icon: '❤️', color: '#E91E63' },
  other: { name: 'אחר', icon: '📋', color: '#607D8B' }
};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
  updateCategoryOptions();
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

      if (!['super_admin', 'admin'].includes(currentUser.role)) {
        showToast('אין לך הרשאת גישה לניהול תקציב', 'error');
        window.location.href = '/admin/dashboard.html';
        return;
      }

      document.getElementById('userName').textContent = `שלום, ${currentUser.name}`;
      loadBudgetData();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    loadSampleData();
  }
}

function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/#login';
}

// ==================== Data Loading ====================

async function loadBudgetData() {
  const year = document.getElementById('yearSelect').value;
  currentYear = parseInt(year);

  try {
    const [transRes, allocRes] = await Promise.all([
      fetch(`${API_BASE}/budget/transactions?year=${year}`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/budget/allocations?year=${year}`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (transRes.ok) transactions = await transRes.json();
    if (allocRes.ok) budgetAllocations = await allocRes.json();
  } catch (error) {
    console.error('Load budget error:', error);
    loadSampleData();
  }

  updateStats();
  renderCharts();
  renderBudgetCategories();
  renderTransactions();
}

function loadSampleData() {
  // Sample transactions
  transactions = [
    { id: 1, date: '2026-01-15', type: 'expense', category: 'salaries', description: 'משכורות ינואר', amount: 45000, vendor: 'צוות עובדים' },
    { id: 2, date: '2026-01-10', type: 'expense', category: 'utilities', description: 'חשמל - דצמבר', amount: 8500, vendor: 'חברת החשמל' },
    { id: 3, date: '2026-01-08', type: 'expense', category: 'maintenance', description: 'תיקון גינות', amount: 3200, vendor: 'גן ירוק בע"מ' },
    { id: 4, date: '2026-01-05', type: 'income', category: 'taxes', description: 'ארנונה ינואר', amount: 85000, vendor: 'תושבים' },
    { id: 5, date: '2026-01-03', type: 'expense', category: 'security', description: 'שירותי שמירה', amount: 12000, vendor: 'חברת אבטחה' },
    { id: 6, date: '2025-12-28', type: 'expense', category: 'events', description: 'אירוע סוף שנה', amount: 15000, vendor: 'הפקות חגים' },
    { id: 7, date: '2025-12-20', type: 'income', category: 'grants', description: 'מענק ממשלתי', amount: 50000, vendor: 'משרד הפנים' },
    { id: 8, date: '2025-12-15', type: 'expense', category: 'salaries', description: 'משכורות דצמבר', amount: 45000, vendor: 'צוות עובדים' }
  ];

  // Sample budget allocations
  budgetAllocations = [
    { category: 'salaries', allocated: 540000, spent: 90000 },
    { category: 'maintenance', allocated: 120000, spent: 15000 },
    { category: 'utilities', allocated: 100000, spent: 8500 },
    { category: 'events', allocated: 80000, spent: 15000 },
    { category: 'security', allocated: 150000, spent: 12000 },
    { category: 'education', allocated: 60000, spent: 0 },
    { category: 'infrastructure', allocated: 200000, spent: 0 },
    { category: 'other', allocated: 50000, spent: 0 }
  ];

  updateStats();
  renderCharts();
  renderBudgetCategories();
  renderTransactions();
}

// ==================== Stats ====================

function updateStats() {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expenses;

  const totalAllocated = budgetAllocations.reduce((sum, a) => sum + a.allocated, 0);
  const totalSpent = budgetAllocations.reduce((sum, a) => sum + a.spent, 0);
  const budgetUsed = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  document.getElementById('totalIncome').textContent = `₪${income.toLocaleString()}`;
  document.getElementById('totalExpenses').textContent = `₪${expenses.toLocaleString()}`;
  document.getElementById('balance').textContent = `₪${balance.toLocaleString()}`;
  document.getElementById('budgetUsed').textContent = `${budgetUsed}%`;

  // Color balance based on positive/negative
  const balanceEl = document.getElementById('balance');
  balanceEl.style.color = balance >= 0 ? 'var(--success-main)' : 'var(--error-main)';
}

// ==================== Charts ====================

function renderCharts() {
  renderExpensesPieChart();
  renderMonthlyTrendChart();
}

function renderExpensesPieChart() {
  const ctx = document.getElementById('expensesPieChart').getContext('2d');

  // Group expenses by category
  const expensesByCategory = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(expensesByCategory).map(k => EXPENSE_CATEGORIES[k]?.name || k);
  const data = Object.values(expensesByCategory);
  const colors = Object.keys(expensesByCategory).map(k => EXPENSE_CATEGORIES[k]?.color || '#607D8B');

  if (expensesPieChart) expensesPieChart.destroy();

  expensesPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          rtl: true,
          labels: {
            font: { family: 'Heebo' },
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ₪${context.raw.toLocaleString()}`
          }
        }
      }
    }
  });
}

function renderMonthlyTrendChart() {
  const ctx = document.getElementById('monthlyTrendChart').getContext('2d');

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  // Group by month
  const incomeByMonth = Array(12).fill(0);
  const expensesByMonth = Array(12).fill(0);

  transactions.forEach(t => {
    const month = new Date(t.date).getMonth();
    if (t.type === 'income') {
      incomeByMonth[month] += t.amount;
    } else {
      expensesByMonth[month] += t.amount;
    }
  });

  if (monthlyTrendChart) monthlyTrendChart.destroy();

  monthlyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'הכנסות',
          data: incomeByMonth,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'הוצאות',
          data: expensesByMonth,
          borderColor: '#F44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          rtl: true,
          labels: { font: { family: 'Heebo' } }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ₪${context.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `₪${value.toLocaleString()}`
          }
        }
      }
    }
  });
}

// ==================== Budget Categories ====================

function renderBudgetCategories() {
  const container = document.getElementById('budgetCategories');

  container.innerHTML = budgetAllocations.map(alloc => {
    const cat = EXPENSE_CATEGORIES[alloc.category] || { name: alloc.category, icon: '📋', color: '#607D8B' };
    const percentage = alloc.allocated > 0 ? Math.round((alloc.spent / alloc.allocated) * 100) : 0;
    const remaining = alloc.allocated - alloc.spent;

    return `
      <div class="budget-category-card">
        <div class="category-header">
          <span class="category-icon" style="background: ${cat.color}20; color: ${cat.color}">${cat.icon}</span>
          <div class="category-info">
            <h4>${cat.name}</h4>
            <span class="category-allocated">תקציב: ₪${alloc.allocated.toLocaleString()}</span>
          </div>
          <span class="category-percentage ${percentage > 90 ? 'danger' : percentage > 70 ? 'warning' : ''}">${percentage}%</span>
        </div>
        <div class="category-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background: ${cat.color}"></div>
          </div>
        </div>
        <div class="category-footer">
          <span>נוצל: ₪${alloc.spent.toLocaleString()}</span>
          <span>נותר: ₪${remaining.toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== Transactions ====================

function renderTransactions() {
  const tbody = document.getElementById('transactionsTable');
  const recent = transactions.slice(0, 10);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">אין תנועות</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(t => {
    const cat = t.type === 'expense' ? EXPENSE_CATEGORIES[t.category] : INCOME_CATEGORIES[t.category];
    return `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${t.description}</td>
        <td>${cat?.icon || ''} ${cat?.name || t.category}</td>
        <td><span class="type-badge type-${t.type}">${t.type === 'income' ? 'הכנסה' : 'הוצאה'}</span></td>
        <td class="amount ${t.type === 'income' ? 'positive' : 'negative'}">
          ${t.type === 'income' ? '+' : '-'}₪${t.amount.toLocaleString()}
        </td>
        <td>
          <button class="action-btn" onclick="editTransaction(${t.id})" title="עריכה">✏️</button>
          <button class="action-btn" onclick="deleteTransaction(${t.id})" title="מחיקה">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==================== Transaction Actions ====================

function showAddTransactionModal() {
  document.getElementById('modalTitle').textContent = 'הוספת תנועה';
  document.getElementById('transactionForm').reset();
  document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
  updateCategoryOptions();
  document.getElementById('transactionModal').classList.remove('hidden');
}

function updateCategoryOptions() {
  const type = document.getElementById('transType').value;
  const select = document.getElementById('transCategory');
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  select.innerHTML = '<option value="">בחר קטגוריה</option>' +
    Object.entries(categories).map(([key, cat]) =>
      `<option value="${key}">${cat.icon} ${cat.name}</option>`
    ).join('');
}

async function saveTransaction() {
  const formData = {
    type: document.getElementById('transType').value,
    date: document.getElementById('transDate').value,
    category: document.getElementById('transCategory').value,
    amount: parseFloat(document.getElementById('transAmount').value),
    description: document.getElementById('transDescription').value,
    notes: document.getElementById('transNotes').value,
    vendor: document.getElementById('transVendor').value,
    invoice_number: document.getElementById('transInvoice').value
  };

  if (!formData.category || !formData.amount || !formData.description) {
    showToast('נא למלא את כל השדות הנדרשים', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/budget/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      showToast('התנועה נשמרה בהצלחה', 'success');
      closeModal();
      loadBudgetData();
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    // For demo, add to local data
    formData.id = Math.max(...transactions.map(t => t.id), 0) + 1;
    transactions.unshift(formData);

    // Update budget allocation
    if (formData.type === 'expense') {
      const alloc = budgetAllocations.find(a => a.category === formData.category);
      if (alloc) alloc.spent += formData.amount;
    }

    showToast('התנועה נשמרה בהצלחה', 'success');
    closeModal();
    updateStats();
    renderCharts();
    renderBudgetCategories();
    renderTransactions();
  }
}

function editTransaction(id) {
  const trans = transactions.find(t => t.id === id);
  if (!trans) return;

  document.getElementById('modalTitle').textContent = 'עריכת תנועה';
  document.getElementById('transType').value = trans.type;
  updateCategoryOptions();
  document.getElementById('transDate').value = trans.date;
  document.getElementById('transCategory').value = trans.category;
  document.getElementById('transAmount').value = trans.amount;
  document.getElementById('transDescription').value = trans.description;
  document.getElementById('transNotes').value = trans.notes || '';
  document.getElementById('transVendor').value = trans.vendor || '';
  document.getElementById('transInvoice').value = trans.invoice_number || '';

  document.getElementById('transactionModal').classList.remove('hidden');
}

async function deleteTransaction(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את התנועה?')) return;

  try {
    const response = await fetch(`${API_BASE}/budget/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('התנועה נמחקה', 'success');
      loadBudgetData();
    } else {
      throw new Error('Delete failed');
    }
  } catch (error) {
    transactions = transactions.filter(t => t.id !== id);
    showToast('התנועה נמחקה', 'success');
    updateStats();
    renderCharts();
    renderTransactions();
  }
}

function closeModal() {
  document.getElementById('transactionModal').classList.add('hidden');
}

function exportReport() {
  showToast('ייצוא דו"ח בקרוב...', 'info');
}

function showAllTransactions() {
  showToast('תצוגת כל התנועות בקרוב...', 'info');
}

function showBudgetAllocationModal() {
  showToast('עריכת הקצאות תקציב בקרוב...', 'info');
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

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// Global functions
window.showAddTransactionModal = showAddTransactionModal;
window.saveTransaction = saveTransaction;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.updateCategoryOptions = updateCategoryOptions;
window.closeModal = closeModal;
window.exportReport = exportReport;
window.showAllTransactions = showAllTransactions;
window.showBudgetAllocationModal = showBudgetAllocationModal;
window.loadBudgetData = loadBudgetData;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
