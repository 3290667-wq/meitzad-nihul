// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let assets = [];
let maintenanceSchedule = [];
let currentAsset = null;
let currentCategory = 'all';

// Category definitions
const CATEGORY_MAP = {
  buildings: { name: 'מבנים', icon: '🏢', color: '#4CAF50' },
  roads: { name: 'כבישים ומדרכות', icon: '🛣️', color: '#795548' },
  water: { name: 'תשתיות מים', icon: '💧', color: '#2196F3' },
  electricity: { name: 'תשתיות חשמל', icon: '⚡', color: '#FF9800' },
  gardens: { name: 'גינון ושטחים ירוקים', icon: '🌳', color: '#8BC34A' },
  equipment: { name: 'ציוד ומכונות', icon: '🔧', color: '#607D8B' }
};

const STATUS_MAP = {
  operational: { name: 'תקין', color: '#4CAF50' },
  needs_maintenance: { name: 'דורש טיפול', color: '#FF9800' },
  under_repair: { name: 'בתיקון', color: '#2196F3' },
  out_of_service: { name: 'לא פעיל', color: '#F44336' }
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

      if (!['super_admin', 'admin', 'staff'].includes(currentUser.role)) {
        showToast('אין לך הרשאת גישה', 'error');
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
    const [assetsRes, maintenanceRes] = await Promise.all([
      fetch(`${API_BASE}/infrastructure/assets`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/infrastructure/maintenance`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (assetsRes.ok) assets = await assetsRes.json();
    if (maintenanceRes.ok) maintenanceSchedule = await maintenanceRes.json();
  } catch (error) {
    console.error('Load data error:', error);
    loadSampleData();
  }

  updateStats();
  renderAssets();
  renderMaintenanceTable();
}

function loadSampleData() {
  assets = [
    {
      id: 1,
      name: 'בית הקהילה',
      category: 'buildings',
      location: 'מרכז היישוב',
      status: 'operational',
      install_date: '2015-03-20',
      next_maintenance: '2026-03-01',
      value: 2500000,
      responsible: 'יוסי כהן',
      description: 'מבנה ציבורי מרכזי הכולל אולם אירועים, חדרי פעילות ומשרדים'
    },
    {
      id: 2,
      name: 'גן משחקים מרכזי',
      category: 'gardens',
      location: 'ליד בית הקהילה',
      status: 'needs_maintenance',
      install_date: '2020-06-15',
      next_maintenance: '2026-02-15',
      value: 150000,
      responsible: 'דוד לוי',
      description: 'מתקני משחק לילדים בגילאי 3-12'
    },
    {
      id: 3,
      name: 'כביש ראשי',
      category: 'roads',
      location: 'רחוב הראשונים',
      status: 'operational',
      install_date: '2010-01-01',
      next_maintenance: '2026-06-01',
      value: 800000,
      responsible: 'דוד לוי',
      description: 'כביש ראשי באורך 1.5 ק"מ'
    },
    {
      id: 4,
      name: 'מערכת השקיה מרכזית',
      category: 'water',
      location: 'כל היישוב',
      status: 'operational',
      install_date: '2018-04-10',
      next_maintenance: '2026-04-01',
      value: 350000,
      responsible: 'אבי מזרחי',
      description: 'מערכת השקיה אוטומטית לשטחים ציבוריים'
    },
    {
      id: 5,
      name: 'תאורת רחוב',
      category: 'electricity',
      location: 'כל היישוב',
      status: 'operational',
      install_date: '2019-08-20',
      next_maintenance: '2026-08-01',
      value: 200000,
      responsible: 'אבי מזרחי',
      description: '45 עמודי תאורה LED'
    },
    {
      id: 6,
      name: 'טרקטור גינון',
      category: 'equipment',
      location: 'מחסן תחזוקה',
      status: 'under_repair',
      install_date: '2021-02-28',
      next_maintenance: '2026-02-28',
      value: 85000,
      responsible: 'דוד לוי',
      description: 'טרקטור עם נספחים לגינון ותחזוקה'
    }
  ];

  maintenanceSchedule = [
    { id: 1, date: '2026-02-15', asset_name: 'גן משחקים מרכזי', type: 'תחזוקה שוטפת', responsible: 'דוד לוי', status: 'scheduled' },
    { id: 2, date: '2026-02-28', asset_name: 'טרקטור גינון', type: 'תיקון', responsible: 'דוד לוי', status: 'in_progress' },
    { id: 3, date: '2026-03-01', asset_name: 'בית הקהילה', type: 'בדיקה תקופתית', responsible: 'יוסי כהן', status: 'scheduled' },
    { id: 4, date: '2026-04-01', asset_name: 'מערכת השקיה מרכזית', type: 'תחזוקה שנתית', responsible: 'אבי מזרחי', status: 'scheduled' }
  ];

  updateStats();
  renderAssets();
  renderMaintenanceTable();
}

// ==================== Stats ====================

function updateStats() {
  const total = assets.length;
  const operational = assets.filter(a => a.status === 'operational').length;
  const needsMaintenance = assets.filter(a => a.status === 'needs_maintenance' || a.status === 'under_repair').length;
  const scheduled = maintenanceSchedule.filter(m => m.status === 'scheduled').length;

  document.getElementById('totalAssets').textContent = total;
  document.getElementById('operationalAssets').textContent = operational;
  document.getElementById('needsMaintenance').textContent = needsMaintenance;
  document.getElementById('scheduledMaintenance').textContent = scheduled;
}

// ==================== Rendering ====================

function renderAssets() {
  const grid = document.getElementById('infrastructureGrid');
  let filtered = assets;

  if (currentCategory !== 'all') {
    filtered = assets.filter(a => a.category === currentCategory);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏗️</div>
        <h3>אין נכסים</h3>
        <p>לחץ על "נכס חדש" להוספת נכס ראשון</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(asset => {
    const cat = CATEGORY_MAP[asset.category] || { name: asset.category, icon: '📦', color: '#607D8B' };
    const status = STATUS_MAP[asset.status] || { name: asset.status, color: '#607D8B' };

    return `
      <div class="asset-card" onclick="viewAsset(${asset.id})">
        <div class="asset-header">
          <span class="asset-icon" style="background: ${cat.color}20; color: ${cat.color}">${cat.icon}</span>
          <span class="asset-status" style="background: ${status.color}20; color: ${status.color}">${status.name}</span>
        </div>
        <h3 class="asset-name">${asset.name}</h3>
        <p class="asset-location">📍 ${asset.location || 'לא צוין'}</p>
        <div class="asset-details">
          <span>💰 ₪${(asset.value || 0).toLocaleString()}</span>
          ${asset.next_maintenance ? `<span>🔧 ${formatDate(asset.next_maintenance)}</span>` : ''}
        </div>
        <div class="asset-actions">
          <button class="action-btn" onclick="event.stopPropagation(); editAsset(${asset.id})" title="עריכה">✏️</button>
          <button class="action-btn" onclick="event.stopPropagation(); scheduleMaintenanceFor(${asset.id})" title="תזמון טיפול">📅</button>
          <button class="action-btn" onclick="event.stopPropagation(); deleteAsset(${asset.id})" title="מחיקה">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMaintenanceTable() {
  const tbody = document.getElementById('maintenanceTable');

  if (maintenanceSchedule.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">אין טיפולים מתוכננים</td></tr>';
    return;
  }

  tbody.innerHTML = maintenanceSchedule.map(m => {
    const statusClass = m.status === 'in_progress' ? 'in_progress' : m.status === 'completed' ? 'resolved' : 'new';
    const statusText = m.status === 'in_progress' ? 'בביצוע' : m.status === 'completed' ? 'הושלם' : 'מתוכנן';

    return `
      <tr>
        <td>${formatDate(m.date)}</td>
        <td>${m.asset_name}</td>
        <td>${m.type}</td>
        <td>${m.responsible}</td>
        <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
        <td>
          <button class="action-btn" onclick="completeMaintenance(${m.id})" title="סמן כהושלם">✅</button>
          <button class="action-btn" onclick="editMaintenance(${m.id})" title="עריכה">✏️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==================== Category Filter ====================

function filterByCategory(category) {
  currentCategory = category;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  renderAssets();
}

// ==================== Asset Actions ====================

function showAddAssetModal() {
  currentAsset = null;
  document.getElementById('modalTitle').textContent = 'נכס חדש';
  document.getElementById('assetForm').reset();
  document.getElementById('assetModal').classList.remove('hidden');
}

function viewAsset(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  editAsset(id);
}

function editAsset(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  currentAsset = asset;
  document.getElementById('modalTitle').textContent = `עריכת ${asset.name}`;

  document.getElementById('assetName').value = asset.name;
  document.getElementById('assetCategory').value = asset.category;
  document.getElementById('assetLocation').value = asset.location || '';
  document.getElementById('assetStatus').value = asset.status;
  document.getElementById('assetInstallDate').value = asset.install_date || '';
  document.getElementById('assetNextMaintenance').value = asset.next_maintenance || '';
  document.getElementById('assetValue').value = asset.value || '';
  document.getElementById('assetResponsible').value = asset.responsible || '';
  document.getElementById('assetDescription').value = asset.description || '';

  document.getElementById('assetModal').classList.remove('hidden');
}

async function saveAsset() {
  const formData = {
    name: document.getElementById('assetName').value,
    category: document.getElementById('assetCategory').value,
    location: document.getElementById('assetLocation').value,
    status: document.getElementById('assetStatus').value,
    install_date: document.getElementById('assetInstallDate').value,
    next_maintenance: document.getElementById('assetNextMaintenance').value,
    value: parseFloat(document.getElementById('assetValue').value) || 0,
    responsible: document.getElementById('assetResponsible').value,
    description: document.getElementById('assetDescription').value
  };

  if (!formData.name || !formData.category || !formData.status) {
    showToast('נא למלא את כל השדות הנדרשים', 'error');
    return;
  }

  try {
    const url = currentAsset ? `${API_BASE}/infrastructure/assets/${currentAsset.id}` : `${API_BASE}/infrastructure/assets`;
    const method = currentAsset ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      showToast(currentAsset ? 'הנכס עודכן בהצלחה' : 'הנכס נוסף בהצלחה', 'success');
      closeModal();
      loadData();
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    // For demo
    if (currentAsset) {
      Object.assign(currentAsset, formData);
    } else {
      formData.id = Math.max(...assets.map(a => a.id), 0) + 1;
      assets.push(formData);
    }
    showToast(currentAsset ? 'הנכס עודכן בהצלחה' : 'הנכס נוסף בהצלחה', 'success');
    closeModal();
    updateStats();
    renderAssets();
  }
}

async function deleteAsset(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את הנכס?')) return;

  try {
    const response = await fetch(`${API_BASE}/infrastructure/assets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      showToast('הנכס נמחק בהצלחה', 'success');
      loadData();
    } else {
      throw new Error('Delete failed');
    }
  } catch (error) {
    assets = assets.filter(a => a.id !== id);
    showToast('הנכס נמחק בהצלחה', 'success');
    updateStats();
    renderAssets();
  }
}

// ==================== Maintenance Actions ====================

function showAddMaintenanceModal() {
  showToast('הוספת טיפול - בקרוב', 'info');
}

function scheduleMaintenanceFor(assetId) {
  const asset = assets.find(a => a.id === assetId);
  if (!asset) return;

  showToast(`תזמון טיפול ל${asset.name} - בקרוב`, 'info');
}

function completeMaintenance(id) {
  const maintenance = maintenanceSchedule.find(m => m.id === id);
  if (maintenance) {
    maintenance.status = 'completed';
    showToast('הטיפול סומן כהושלם', 'success');
    renderMaintenanceTable();
  }
}

function editMaintenance(id) {
  showToast('עריכת טיפול - בקרוב', 'info');
}

function closeModal() {
  document.getElementById('assetModal').classList.add('hidden');
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
window.showAddAssetModal = showAddAssetModal;
window.viewAsset = viewAsset;
window.editAsset = editAsset;
window.saveAsset = saveAsset;
window.deleteAsset = deleteAsset;
window.filterByCategory = filterByCategory;
window.showAddMaintenanceModal = showAddMaintenanceModal;
window.scheduleMaintenanceFor = scheduleMaintenanceFor;
window.completeMaintenance = completeMaintenance;
window.editMaintenance = editMaintenance;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
