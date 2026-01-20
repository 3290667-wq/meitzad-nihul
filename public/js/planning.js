// Planning & Construction Module for Meitzad Management System
// Uses API instead of Firebase

const Planning = {
  boardChart: null,

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addBtn = document.getElementById('add-project-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddProjectModal());
    }

    // Status filter buttons
    document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn[data-status]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadProjects(e.target.dataset.status);
      });
    });
  },

  // Category definitions
  CATEGORIES: {
    growth: { name: 'צמיחה ופיתוח', icon: 'trending_up', color: '#4CAF50' },
    infrastructure: { name: 'תשתיות', icon: 'foundation', color: '#2196F3' },
    community: { name: 'קהילה וחברה', icon: 'groups', color: '#FF9800' },
    environment: { name: 'סביבה וקיימות', icon: 'eco', color: '#8BC34A' },
    education: { name: 'חינוך', icon: 'school', color: '#9C27B0' },
    security: { name: 'ביטחון', icon: 'shield', color: '#F44336' },
    other: { name: 'אחר', icon: 'folder', color: '#607D8B' }
  },

  // Status definitions
  STATUSES: {
    idea: { name: 'רעיון', color: '#9E9E9E' },
    planning: { name: 'בתכנון', color: '#2196F3' },
    approved: { name: 'מאושר', color: '#00BCD4' },
    in_progress: { name: 'בביצוע', color: '#FF9800' },
    completed: { name: 'הושלם', color: '#4CAF50' },
    on_hold: { name: 'מושהה', color: '#F44336' },
    cancelled: { name: 'בוטל', color: '#9E9E9E' }
  },

  // Priority definitions
  PRIORITIES: {
    low: { name: 'נמוכה', color: '#9E9E9E' },
    medium: { name: 'בינונית', color: '#2196F3' },
    high: { name: 'גבוהה', color: '#FF9800' },
    critical: { name: 'קריטית', color: '#F44336' }
  },

  async load() {
    Utils.showLoading();
    try {
      await Promise.all([
        this.loadProjects(),
        this.updateStats()
      ]);
    } catch (error) {
      console.error('Planning load error:', error);
      Utils.toast('שגיאה בטעינת פרויקטים', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async loadProjects(statusFilter = 'all') {
    const board = document.getElementById('projects-board');
    if (!board) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const projects = await API.get(`/api/projects?${params.toString()}`);

      if (!projects || projects.length === 0) {
        board.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <span class="material-symbols-rounded">folder_off</span>
            <p>אין פרויקטים במערכת</p>
            <button class="btn btn-primary" onclick="Planning.showAddProjectModal()">
              <span class="material-symbols-rounded">add</span>
              פרויקט חדש
            </button>
          </div>
        `;
        return;
      }

      // Group by status for Kanban board
      const columns = {
        idea: [],
        planning: [],
        approved: [],
        in_progress: [],
        completed: []
      };

      projects.forEach(project => {
        if (columns[project.status]) {
          columns[project.status].push(project);
        }
      });

      // Sort each column by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      Object.keys(columns).forEach(status => {
        columns[status].sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
      });

      board.innerHTML = Object.entries(columns).map(([status, items]) => {
        const statusInfo = this.STATUSES[status];
        return `
          <div class="board-column" data-status="${status}">
            <div class="board-column-header" style="border-color: ${statusInfo.color}">
              <h4>${statusInfo.name}</h4>
              <span class="column-count">${items.length}</span>
            </div>
            <div class="board-column-content">
              ${items.length > 0 ? items.map(project => this.renderProjectCard(project)).join('') : `
                <div class="column-empty">
                  <span class="material-symbols-rounded">inbox</span>
                  <p>אין פרויקטים</p>
                </div>
              `}
            </div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading projects:', error);
    }
  },

  renderProjectCard(project) {
    const category = this.CATEGORIES[project.category] || { name: project.category, icon: 'folder', color: '#607D8B' };
    const priority = this.PRIORITIES[project.priority] || { name: project.priority, color: '#607D8B' };

    const milestones = project.milestones || [];
    const completedMilestones = milestones.filter(m => m.completed).length;
    const totalMilestones = milestones.length;
    const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    return `
      <div class="project-card" onclick="Planning.viewProject('${project.id}')" data-project-id="${project.id}">
        <div class="project-card-header">
          <span class="project-category" style="background: ${category.color}20; color: ${category.color}">
            <span class="material-symbols-rounded">${category.icon}</span>
            ${category.name}
          </span>
          <span class="project-priority" style="background: ${priority.color}20; color: ${priority.color}">
            ${priority.name}
          </span>
        </div>
        <h4 class="project-card-title">${project.name}</h4>
        <p class="project-card-description">${Utils.truncate(project.description || '', 80)}</p>
        <div class="project-card-meta">
          <span>
            <span class="material-symbols-rounded">event</span>
            ${project.end_date ? Utils.formatDate(new Date(project.end_date).getTime()) : 'לא נקבע'}
          </span>
          <span>
            <span class="material-symbols-rounded">payments</span>
            ${Utils.formatCurrency(project.budget || 0)}
          </span>
        </div>
        ${totalMilestones > 0 ? `
          <div class="project-card-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%; background: ${category.color}"></div>
            </div>
            <span class="progress-text">${completedMilestones}/${totalMilestones} אבני דרך</span>
          </div>
        ` : ''}
        <div class="project-card-footer">
          <span class="project-owner">
            <span class="material-symbols-rounded">person</span>
            ${project.owner || 'לא הוקצה'}
          </span>
        </div>
      </div>
    `;
  },

  async updateStats() {
    try {
      const stats = await API.get('/api/projects/stats/summary');

      // Count by category from stats
      const growthEl = document.getElementById('growth-projects');
      const infraEl = document.getElementById('infra-projects');
      const communityEl = document.getElementById('community-projects');
      const envEl = document.getElementById('env-projects');

      const byCategory = stats.byCategory || [];
      const getCatCount = (cat) => byCategory.find(c => c.category === cat)?.count || 0;

      if (growthEl) growthEl.textContent = getCatCount('growth');
      if (infraEl) infraEl.textContent = getCatCount('infrastructure');
      if (communityEl) communityEl.textContent = getCatCount('community');
      if (envEl) envEl.textContent = getCatCount('environment');

    } catch (error) {
      console.error('Error updating stats:', error);
    }
  },

  showAddProjectModal(project = null) {
    const isEdit = !!project;

    const categoryOptions = Object.entries(this.CATEGORIES)
      .map(([value, { name }]) => `<option value="${value}" ${project?.category === value ? 'selected' : ''}>${name}</option>`)
      .join('');

    const priorityOptions = Object.entries(this.PRIORITIES)
      .map(([value, { name }]) => `<option value="${value}" ${project?.priority === value ? 'selected' : ''}>${name}</option>`)
      .join('');

    const statusOptions = Object.entries(this.STATUSES)
      .map(([value, { name }]) => `<option value="${value}" ${project?.status === value ? 'selected' : ''}>${name}</option>`)
      .join('');

    const milestones = project?.milestones || [];

    const content = `
      <form id="project-form">
        <div class="form-group">
          <label for="proj-name">שם הפרויקט *</label>
          <input type="text" id="proj-name" name="name" required value="${project?.name || ''}" placeholder="הרחבת בית הקהילה">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="proj-category">קטגוריה *</label>
            <select id="proj-category" name="category" required>
              <option value="">בחר קטגוריה</option>
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="proj-priority">עדיפות</label>
            <select id="proj-priority" name="priority">
              ${priorityOptions}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="proj-description">תיאור</label>
          <textarea id="proj-description" name="description" rows="3" placeholder="תיאור הפרויקט...">${project?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="proj-start-date">תאריך התחלה</label>
            <input type="date" id="proj-start-date" name="start_date" value="${project?.start_date || ''}">
          </div>
          <div class="form-group">
            <label for="proj-end-date">תאריך סיום משוער</label>
            <input type="date" id="proj-end-date" name="end_date" value="${project?.end_date || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="proj-budget">תקציב (₪)</label>
            <input type="number" id="proj-budget" name="budget" value="${project?.budget || ''}" placeholder="500000">
          </div>
          <div class="form-group">
            <label for="proj-status">סטטוס</label>
            <select id="proj-status" name="status">
              ${statusOptions}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="proj-owner">אחראי</label>
          <input type="text" id="proj-owner" name="owner" value="${project?.owner || ''}" placeholder="שם האחראי">
        </div>

        <div class="form-section">
          <div class="form-section-header">
            <h4>אבני דרך</h4>
            <button type="button" class="btn btn-sm btn-outline" onclick="Planning.addMilestoneField()">
              <span class="material-symbols-rounded">add</span>
              הוסף אבן דרך
            </button>
          </div>
          <div id="milestones-container">
            ${milestones.map((m, i) => `
              <div class="milestone-item">
                <input type="text" value="${m.name || ''}" placeholder="שם אבן דרך" class="milestone-name">
                <input type="date" value="${m.date || ''}" class="milestone-date">
                <label class="milestone-completed">
                  <input type="checkbox" ${m.completed ? 'checked' : ''}>
                  הושלם
                </label>
                <button type="button" class="btn btn-sm btn-ghost btn-danger" onclick="this.parentElement.remove()">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="Utils.closeModal()">ביטול</button>
      ${isEdit ? `<button class="btn btn-danger" onclick="Planning.deleteProject('${project.id}')">מחק</button>` : ''}
      <button class="btn btn-primary" onclick="Planning.saveProject('${project?.id || ''}')">${isEdit ? 'שמור שינויים' : 'צור פרויקט'}</button>
    `;

    Utils.openModal(isEdit ? 'עריכת פרויקט' : 'פרויקט חדש', content, footer);
  },

  addMilestoneField() {
    const container = document.getElementById('milestones-container');
    const div = document.createElement('div');
    div.className = 'milestone-item';
    div.innerHTML = `
      <input type="text" placeholder="שם אבן דרך" class="milestone-name">
      <input type="date" class="milestone-date">
      <label class="milestone-completed">
        <input type="checkbox">
        הושלם
      </label>
      <button type="button" class="btn btn-sm btn-ghost btn-danger" onclick="this.parentElement.remove()">
        <span class="material-symbols-rounded">delete</span>
      </button>
    `;
    container.appendChild(div);
  },

  async saveProject(existingId = '') {
    const form = document.getElementById('project-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Collect milestones
    const milestones = [];
    document.querySelectorAll('.milestone-item').forEach(item => {
      const name = item.querySelector('.milestone-name').value;
      const date = item.querySelector('.milestone-date').value;
      const completed = item.querySelector('.milestone-completed input').checked;
      if (name && date) {
        milestones.push({ name, date, completed });
      }
    });

    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date'),
      budget: parseFloat(formData.get('budget')) || 0,
      priority: formData.get('priority'),
      status: formData.get('status'),
      owner: formData.get('owner'),
      milestones
    };

    try {
      if (existingId) {
        await API.put(`/api/projects/${existingId}`, data);
        Utils.toast('הפרויקט עודכן בהצלחה', 'success');
      } else {
        await API.post('/api/projects', data);
        Utils.toast('הפרויקט נוצר בהצלחה', 'success');
      }

      Utils.closeModal();
      this.load();
    } catch (error) {
      console.error('Error saving project:', error);
      Utils.toast('שגיאה בשמירת הפרויקט', 'error');
    }
  },

  async viewProject(id) {
    try {
      const project = await API.get(`/api/projects/${id}`);

      if (!project) {
        Utils.toast('הפרויקט לא נמצא', 'error');
        return;
      }

      const category = this.CATEGORIES[project.category] || { name: project.category, icon: 'folder', color: '#607D8B' };
      const status = this.STATUSES[project.status] || { name: project.status, color: '#607D8B' };
      const priority = this.PRIORITIES[project.priority] || { name: project.priority, color: '#607D8B' };

      const milestones = project.milestones || [];
      const completedMilestones = milestones.filter(m => m.completed).length;
      const totalMilestones = milestones.length;
      const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

      const content = `
        <div class="project-detail">
          <div class="project-detail-header">
            <div class="project-detail-badges">
              <span class="project-category" style="background: ${category.color}20; color: ${category.color}">
                <span class="material-symbols-rounded">${category.icon}</span>
                ${category.name}
              </span>
              <span class="project-status" style="background: ${status.color}20; color: ${status.color}">
                ${status.name}
              </span>
              <span class="project-priority" style="background: ${priority.color}20; color: ${priority.color}">
                עדיפות ${priority.name}
              </span>
            </div>
          </div>

          ${project.description ? `
            <div class="project-detail-description">
              <p>${project.description}</p>
            </div>
          ` : ''}

          <div class="detail-grid">
            <div class="detail-item">
              <span class="material-symbols-rounded">event_upcoming</span>
              <div>
                <label>תאריך התחלה</label>
                <span>${project.start_date ? Utils.formatDate(new Date(project.start_date).getTime()) : 'לא נקבע'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">event</span>
              <div>
                <label>תאריך סיום</label>
                <span>${project.end_date ? Utils.formatDate(new Date(project.end_date).getTime()) : 'לא נקבע'}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">payments</span>
              <div>
                <label>תקציב</label>
                <span>${Utils.formatCurrency(project.budget || 0)}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="material-symbols-rounded">person</span>
              <div>
                <label>אחראי</label>
                <span>${project.owner || 'לא הוקצה'}</span>
              </div>
            </div>
          </div>

          ${totalMilestones > 0 ? `
            <div class="project-milestones-section">
              <h4>אבני דרך (${completedMilestones}/${totalMilestones})</h4>
              <div class="progress-bar large">
                <div class="progress-fill" style="width: ${progress}%; background: ${category.color}"></div>
              </div>
              <div class="milestones-list">
                ${milestones.map(m => `
                  <div class="milestone-list-item ${m.completed ? 'completed' : ''}">
                    <span class="material-symbols-rounded">${m.completed ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <div class="milestone-info">
                      <span class="milestone-name">${m.name}</span>
                      <span class="milestone-date">${m.date ? Utils.formatDate(new Date(m.date).getTime()) : ''}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">סגור</button>
        <button class="btn btn-primary" onclick="Planning.editProject('${id}')">
          <span class="material-symbols-rounded">edit</span>
          עריכה
        </button>
      `;

      Utils.openModal(project.name, content, footer);

    } catch (error) {
      console.error('Error viewing project:', error);
      Utils.toast('שגיאה בטעינת פרטי הפרויקט', 'error');
    }
  },

  async editProject(id) {
    try {
      const project = await API.get(`/api/projects/${id}`);

      if (!project) {
        Utils.toast('הפרויקט לא נמצא', 'error');
        return;
      }

      Utils.closeModal();
      setTimeout(() => {
        this.showAddProjectModal({ id, ...project });
      }, 300);

    } catch (error) {
      console.error('Error editing project:', error);
      Utils.toast('שגיאה בטעינת פרטי הפרויקט', 'error');
    }
  },

  async deleteProject(id) {
    Utils.confirm(
      'מחיקת פרויקט',
      'האם אתה בטוח שברצונך למחוק את הפרויקט?',
      async () => {
        try {
          await API.delete(`/api/projects/${id}`);
          Utils.toast('הפרויקט נמחק בהצלחה', 'success');
          Utils.closeModal();
          this.load();
        } catch (error) {
          console.error('Error deleting project:', error);
          Utils.toast('שגיאה במחיקת הפרויקט', 'error');
        }
      }
    );
  },

  cleanup() {
    if (this.boardChart) {
      this.boardChart.destroy();
      this.boardChart = null;
    }
  }
};

window.Planning = Planning;
