const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all projects
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, category, priority } = req.query;

    let query = `
      SELECT p.*, u.name as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (category && category !== 'all') {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    if (priority && priority !== 'all') {
      query += ` AND p.priority = ?`;
      params.push(priority);
    }

    query += ` ORDER BY
      CASE p.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      p.created_at DESC`;

    const projects = db.prepare(query).all(...params);

    // Parse milestones JSON
    const projectsWithMilestones = projects.map(p => ({
      ...p,
      milestones: p.milestones ? JSON.parse(p.milestones) : []
    }));

    res.json(projectsWithMilestones);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פרויקטים' });
  }
});

// Get single project
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, u.name as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'הפרויקט לא נמצא' });
    }

    // Parse milestones
    project.milestones = project.milestones ? JSON.parse(project.milestones) : [];

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפרויקט' });
  }
});

// Create project
router.post('/', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      name, description, category, priority, status, budget,
      start_date, end_date, owner, milestones
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'שם הפרויקט הוא שדה חובה' });
    }

    const result = db.prepare(`
      INSERT INTO projects (
        name, description, category, priority, status, budget,
        start_date, end_date, owner, milestones, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, description, category || 'other', priority || 'medium', status || 'idea',
      budget || 0, start_date, end_date, owner,
      JSON.stringify(milestones || []), req.user.id
    );

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    newProject.milestones = JSON.parse(newProject.milestones || '[]');

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('project:created', newProject);
    }

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת פרויקט' });
  }
});

// Update project
router.put('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      name, description, category, priority, status, budget, spent,
      start_date, end_date, owner, milestones
    } = req.body;

    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        description = ?,
        category = COALESCE(?, category),
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        budget = COALESCE(?, budget),
        spent = COALESCE(?, spent),
        start_date = ?,
        end_date = ?,
        owner = ?,
        milestones = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name, description, category, priority, status, budget, spent,
      start_date, end_date, owner,
      milestones ? JSON.stringify(milestones) : null,
      req.params.id
    );

    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    updatedProject.milestones = JSON.parse(updatedProject.milestones || '[]');

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('project:updated', updatedProject);
    }

    res.json(updatedProject);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הפרויקט' });
  }
});

// Update project status only
router.patch('/:id/status', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;

    db.prepare(`
      UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, req.params.id);

    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    updatedProject.milestones = JSON.parse(updatedProject.milestones || '[]');

    res.json(updatedProject);
  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס הפרויקט' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת הפרויקט' });
  }
});

// Get project statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM projects
      GROUP BY status
    `).all();

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM projects
      GROUP BY category
    `).all();

    const budgetSummary = db.prepare(`
      SELECT
        SUM(budget) as total_budget,
        SUM(spent) as total_spent
      FROM projects
      WHERE status IN ('in_progress', 'planning', 'approved')
    `).get();

    res.json({
      byStatus,
      byCategory,
      budget: {
        total: budgetSummary?.total_budget || 0,
        spent: budgetSummary?.total_spent || 0
      }
    });
  } catch (error) {
    console.error('Project stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

module.exports = router;
