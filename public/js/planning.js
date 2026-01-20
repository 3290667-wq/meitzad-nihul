// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let projects = [];
let kpis = [];
let currentProject = null;
let currentFilter = 'all';
let currentGoal = 'all';
let timelineView = '5year';
let budgetForecastChart = null;

// Category definitions
const CATEGORY_MAP = {
  growth: { name: 'צמיחה ופיתוח', icon: '📈', color: '#4CAF50' },
  infrastructure: { name: 'תשתיות', icon: '🏗️', color: '#2196F3' },
  community: { name: 'קהילה וחברה', icon: '👨‍👩‍👧‍👦', color: '#FF9800' },
  environment: { name: 'סביבה וקיימות', icon: '🌱', color: '#8BC34A' },
  education: { name: 'חינוך', icon: '📚', color: '#9C27B0' },
  security: { name: 'ביטחון', icon: '🔒', color: '#F44336' }
};

const STATUS_MAP = {
  idea: { name: 'רעיון', color: '#9E9E9E' },
  planning: { name: 'בתכנון', color: '#2196F3' },
  approved: { name: 'מאושר', color: '#00BCD4' },
  in_progress: { name: 'בביצוע', color: '#FF9800' },
  completed: { name: 'הושלם', color: '#4CAF50' },
  on_hold: { name: 'מושהה', color: '#F44336' }
};

const PRIORITY_MAP = {
  low: { name: 'נמוכה', color: '#9E9E9E' },
  medium: { name: 'בינונית', color: '#2196F3' },
  high: { name: 'גבוהה', color: '#FF9800' },
  critical: { name: 'קריטית', color: '#F44336' }
};

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
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
        showToast('אין לך הרשאת גישה לתכנון אסטרטגי', 'error');
        window.location.href = '/admin/dashboard.html';
        return;
      }

      document.getElementById('userName').textContent = `שלום, ${currentUser.name}`;
      loadData();
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

async function loadData() {
  try {
    const [projectsRes, kpisRes] = await Promise.all([
      fetch(`${API_BASE}/planning/projects`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/planning/kpis`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (projectsRes.ok) projects = await projectsRes.json();
    if (kpisRes.ok) kpis = await kpisRes.json();
  } catch (error) {
    console.error('Load data error:', error);
    loadSampleData();
  }

  updateStats();
  renderTimeline();
  renderProjects();
  renderKPIs();
  renderBudgetForecast();
}

function loadSampleData() {
  projects = [
    {
      id: 1,
      name: 'הרחבת בית הקהילה',
      category: 'infrastructure',
      description: 'הוספת אגף חדש למבנה בית הקהילה הכולל חדרי פעילות נוספים ומרחב רב תכליתי',
      start_date: '2026-06-01',
      end_date: '2027-12-31',
      budget: 3500000,
      priority: 'high',
      status: 'planning',
      owner: 'יוסי כהן',
      milestones: [
        { name: 'אישור תכנית', date: '2026-03-01', completed: true },
        { name: 'מכרז קבלנים', date: '2026-05-01', completed: false },
        { name: 'תחילת בנייה', date: '2026-06-01', completed: false },
        { name: 'סיום בנייה', date: '2027-12-31', completed: false }
      ]
    },
    {
      id: 2,
      name: 'פרויקט אנרגיה ירוקה',
      category: 'environment',
      description: 'התקנת מערכות סולאריות על גגות מבנים ציבוריים ומעבר לתאורת LED בכל היישוב',
      start_date: '2026-03-01',
      end_date: '2026-12-31',
      budget: 800000,
      priority: 'medium',
      status: 'approved',
      owner: 'אבי מזרחי',
      milestones: []
    },
    {
      id: 3,
      name: 'מרכז ספורט קהילתי',
      category: 'community',
      description: 'הקמת מרכז ספורט הכולל חדר כושר, מגרש כדורסל ובריכה',
      start_date: '2027-01-01',
      end_date: '2029-06-30',
      budget: 8000000,
      priority: 'medium',
      status: 'idea',
      owner: 'וועדת ספורט',
      milestones: []
    },
    {
      id: 4,
      name: 'שדרוג מערכת הביטחון',
      category: 'security',
      description: 'החלפת מערכת המצלמות והגדרות הביטחון לטכנולוגיה מתקדמת',
      start_date: '2026-02-01',
      end_date: '2026-08-31',
      budget: 500000,
      priority: 'critical',
      status: 'in_progress',
      owner: 'משה אברהם',
      milestones: [
        { name: 'התקנת מצלמות', date: '2026-04-01', completed: true },
        { name: 'שדרוג גדרות', date: '2026-06-01', completed: false },
        { name: 'הדרכת צוות', date: '2026-08-01', completed: false }
      ]
    },
    {
      id: 5,
      name: 'גני ילדים חדשים',
      category: 'education',
      description: 'הקמת שני גני ילדים חדשים לאור גידול האוכלוסייה',
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      budget: 2000000,
      priority: 'high',
      status: 'planning',
      owner: 'שרה ישראלי',
      milestones: []
    },
    {
      id: 6,
      name: 'פיתוח שכונה חדשה',
      category: 'growth',
      description: 'תכנון ופיתוח שכונה חדשה עם 50 יחידות דיור',
      start_date: '2027-01-01',
      end_date: '2030-12-31',
      budget: 15000000,
      priority: 'high',
      status: 'idea',
      owner: 'וועד מקומי',
      milestones: []
    }
  ];

  kpis = [
    { id: 1, name: 'גידול אוכלוסייה', target: 150, current: 125, unit: 'משפחות', trend: 'up' },
    { id: 2, name: 'שביעות רצון תושבים', target: 90, current: 82, unit: '%', trend: 'up' },
    { id: 3, name: 'ניצול תקציב', target: 95, current: 78, unit: '%', trend: 'stable' },
    { id: 4, name: 'פרויקטים שהושלמו', target: 10, current: 3, unit: '', trend: 'up' },
    { id: 5, name: 'זמן תגובה לפניות', target: 48, current: 36, unit: 'שעות', trend: 'down' },
    { id: 6, name: 'השתתפות באירועים', target: 70, current: 65, unit: '%', trend: 'up' }
  ];

  updateStats();
  renderTimeline();
  renderProjects();
  renderKPIs();
  renderBudgetForecast();
}

// ==================== Stats ====================

function updateStats() {
  const byCat = {
    growth: projects.filter(p => p.category === 'growth').length,
    infrastructure: projects.filter(p => p.category === 'infrastructure').length,
    community: projects.filter(p => p.category === 'community').length,
    environment: projects.filter(p => p.category === 'environment').length
  };

  document.getElementById('growthProjects').textContent = byCat.growth;
  document.getElementById('infraProjects').textContent = byCat.infrastructure;
  document.getElementById('communityProjects').textContent = byCat.community;
  document.getElementById('envProjects').textContent = byCat.environment;
}

// ==================== Timeline ====================

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  const currentYear = new Date().getFullYear();
  let years = [];

  switch (timelineView) {
    case '1year':
      years = [currentYear];
      break;
    case '3year':
      years = [currentYear, currentYear + 1, currentYear + 2];
      break;
    case '5year':
    default:
      years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
  }

  let html = `
    <div class="timeline">
      <div class="timeline-years">
        ${years.map(y => `<div class="timeline-year">${y}</div>`).join('')}
      </div>
      <div class="timeline-projects">
  `;

  projects.forEach(project => {
    const startYear = new Date(project.start_date).getFullYear();
    const endYear = new Date(project.end_date).getFullYear();

    if (startYear <= years[years.length - 1] && endYear >= years[0]) {
      const cat = CATEGORY_MAP[project.category] || { color: '#607D8B', icon: '📋' };
      const status = STATUS_MAP[project.status] || { name: project.status };

      const startPos = Math.max(0, (startYear - years[0]) / years.length * 100);
      const endPos = Math.min(100, (endYear - years[0] + 1) / years.length * 100);
      const width = endPos - startPos;

      html += `
        <div class="timeline-project" style="right: ${startPos}%; width: ${width}%;" onclick="viewProject(${project.id})">
          <div class="project-bar" style="background: ${cat.color}">
            <span class="project-name">${cat.icon} ${project.name}</span>
          </div>
        </div>
      `;
    }
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function setTimelineView(view) {
  timelineView = view;

  document.querySelectorAll('.timeline-controls .btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(
      view === '5year' ? '5' : view === '3year' ? '3' : 'שנה'
    ));
  });

  renderTimeline();
}

// ==================== Projects ====================

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  let filtered = projects;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(p => p.status === currentFilter);
  }

  if (currentGoal !== 'all') {
    filtered = filtered.filter(p => p.category === currentGoal);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>אין פרויקטים</h3>
        <p>לחץ על "פרויקט חדש" להוספת פרויקט</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(project => {
    const cat = CATEGORY_MAP[project.category] || { name: project.category, icon: '📋', color: '#607D8B' };
    const status = STATUS_MAP[project.status] || { name: project.status, color: '#607D8B' };
    const priority = PRIORITY_MAP[project.priority] || { name: project.priority, color: '#607D8B' };

    const completedMilestones = project.milestones?.filter(m => m.completed).length || 0;
    const totalMilestones = project.milestones?.length || 0;
    const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    return `
      <div class="project-card" onclick="viewProject(${project.id})">
        <div class="project-header">
          <span class="project-category" style="background: ${cat.color}20; color: ${cat.color}">
            ${cat.icon} ${cat.name}
          </span>
          <span class="project-priority" style="background: ${priority.color}20; color: ${priority.color}">
            ${priority.name}
          </span>
        </div>
        <h3 class="project-title">${project.name}</h3>
        <p class="project-description">${project.description.substring(0, 100)}...</p>
        <div class="project-meta">
          <span>📅 ${formatDate(project.start_date)} - ${formatDate(project.end_date)}</span>
          <span>💰 ₪${(project.budget || 0).toLocaleString()}</span>
        </div>
        ${totalMilestones > 0 ? `
          <div class="project-progress">
            <div class="progress-label">התקדמות: ${progress}%</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%; background: ${cat.color}"></div>
            </div>
          </div>
        ` : ''}
        <div class="project-footer">
          <span class="project-status" style="background: ${status.color}20; color: ${status.color}">
            ${status.name}
          </span>
          <span class="project-owner">👤 ${project.owner}</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjects(status) {
  currentFilter = status;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });

  renderProjects();
}

function filterByGoal(goal) {
  currentGoal = goal === currentGoal ? 'all' : goal;
  renderProjects();
}

// ==================== KPIs ====================

function renderKPIs() {
  const grid = document.getElementById('kpisGrid');

  grid.innerHTML = kpis.map(kpi => {
    const percentage = Math.round((kpi.current / kpi.target) * 100);
    const trendIcon = kpi.trend === 'up' ? '📈' : kpi.trend === 'down' ? '📉' : '➡️';
    const color = percentage >= 90 ? '#4CAF50' : percentage >= 70 ? '#FF9800' : '#F44336';

    return `
      <div class="kpi-card">
        <div class="kpi-header">
          <h4>${kpi.name}</h4>
          <span class="kpi-trend">${trendIcon}</span>
        </div>
        <div class="kpi-value">
          <span class="current">${kpi.current}</span>
          <span class="unit">${kpi.unit}</span>
        </div>
        <div class="kpi-target">יעד: ${kpi.target} ${kpi.unit}</div>
        <div class="kpi-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background: ${color}"></div>
          </div>
          <span class="percentage">${percentage}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== Budget Forecast ====================

function renderBudgetForecast() {
  const ctx = document.getElementById('budgetForecastChart').getContext('2d');
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];

  // Calculate budget per year
  const budgetByYear = years.map(year => {
    return projects.reduce((sum, p) => {
      const startYear = new Date(p.start_date).getFullYear();
      const endYear = new Date(p.end_date).getFullYear();

      if (year >= startYear && year <= endYear) {
        const projectYears = endYear - startYear + 1;
        return sum + (p.budget / projectYears);
      }
      return sum;
    }, 0);
  });

  if (budgetForecastChart) budgetForecastChart.destroy();

  budgetForecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years.map(y => y.toString()),
      datasets: [{
        label: 'תקציב מתוכנן',
        data: budgetByYear,
        backgroundColor: 'rgba(46, 161, 179, 0.7)',
        borderColor: 'rgba(46, 161, 179, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `₪${context.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `₪${(value / 1000000).toFixed(1)}M`
          }
        }
      }
    }
  });
}

// ==================== Project Modal ====================

function showAddProjectModal() {
  currentProject = null;
  document.getElementById('modalTitle').textContent = 'פרויקט חדש';
  document.getElementById('projectForm').reset();
  document.getElementById('milestonesContainer').innerHTML = '';
  document.getElementById('projectModal').classList.remove('hidden');
}

function viewProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;

  currentProject = project;
  document.getElementById('modalTitle').textContent = project.name;

  document.getElementById('projName').value = project.name;
  document.getElementById('projCategory').value = project.category;
  document.getElementById('projDescription').value = project.description;
  document.getElementById('projStartDate').value = project.start_date;
  document.getElementById('projEndDate').value = project.end_date;
  document.getElementById('projBudget').value = project.budget || '';
  document.getElementById('projPriority').value = project.priority;
  document.getElementById('projStatus').value = project.status;
  document.getElementById('projOwner').value = project.owner || '';

  // Render milestones
  const container = document.getElementById('milestonesContainer');
  container.innerHTML = (project.milestones || []).map((m, i) => `
    <div class="milestone-item">
      <input type="text" value="${m.name}" placeholder="שם אבן דרך" class="milestone-name">
      <input type="date" value="${m.date}" class="milestone-date">
      <label><input type="checkbox" ${m.completed ? 'checked' : ''}> הושלם</label>
      <button type="button" class="action-btn" onclick="removeMilestone(${i})">🗑️</button>
    </div>
  `).join('');

  document.getElementById('projectModal').classList.remove('hidden');
}

function addMilestone() {
  const container = document.getElementById('milestonesContainer');
  const div = document.createElement('div');
  div.className = 'milestone-item';
  div.innerHTML = `
    <input type="text" placeholder="שם אבן דרך" class="milestone-name">
    <input type="date" class="milestone-date">
    <label><input type="checkbox"> הושלם</label>
    <button type="button" class="action-btn" onclick="this.parentElement.remove()">🗑️</button>
  `;
  container.appendChild(div);
}

function removeMilestone(index) {
  const items = document.querySelectorAll('.milestone-item');
  if (items[index]) items[index].remove();
}

async function saveProject() {
  // Collect milestones
  const milestones = [];
  document.querySelectorAll('.milestone-item').forEach(item => {
    const name = item.querySelector('.milestone-name').value;
    const date = item.querySelector('.milestone-date').value;
    const completed = item.querySelector('input[type="checkbox"]').checked;
    if (name && date) {
      milestones.push({ name, date, completed });
    }
  });

  const formData = {
    name: document.getElementById('projName').value,
    category: document.getElementById('projCategory').value,
    description: document.getElementById('projDescription').value,
    start_date: document.getElementById('projStartDate').value,
    end_date: document.getElementById('projEndDate').value,
    budget: parseFloat(document.getElementById('projBudget').value) || 0,
    priority: document.getElementById('projPriority').value,
    status: document.getElementById('projStatus').value,
    owner: document.getElementById('projOwner').value,
    milestones
  };

  if (!formData.name || !formData.category || !formData.description) {
    showToast('נא למלא את כל השדות הנדרשים', 'error');
    return;
  }

  try {
    const url = currentProject ? `${API_BASE}/planning/projects/${currentProject.id}` : `${API_BASE}/planning/projects`;
    const method = currentProject ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      showToast(currentProject ? 'הפרויקט עודכן' : 'הפרויקט נוצר', 'success');
      closeModal();
      loadData();
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    // For demo
    if (currentProject) {
      Object.assign(currentProject, formData);
    } else {
      formData.id = Math.max(...projects.map(p => p.id), 0) + 1;
      projects.push(formData);
    }
    showToast(currentProject ? 'הפרויקט עודכן' : 'הפרויקט נוצר', 'success');
    closeModal();
    updateStats();
    renderTimeline();
    renderProjects();
    renderBudgetForecast();
  }
}

function editVision() {
  showToast('עריכת חזון - בקרוב', 'info');
}

function closeModal() {
  document.getElementById('projectModal').classList.add('hidden');
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
window.showAddProjectModal = showAddProjectModal;
window.viewProject = viewProject;
window.saveProject = saveProject;
window.addMilestone = addMilestone;
window.removeMilestone = removeMilestone;
window.filterProjects = filterProjects;
window.filterByGoal = filterByGoal;
window.setTimelineView = setTimelineView;
window.editVision = editVision;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
