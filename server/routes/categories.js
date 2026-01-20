const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all categories
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT * FROM categories ORDER BY sort_order ASC, id ASC
    `).all();

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת קטגוריות' });
  }
});

// Get single category
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'הקטגוריה לא נמצאה' });
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הקטגוריה' });
  }
});

// Create category
router.post('/', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { name, name_he, description, icon, sort_order, is_active } = req.body;

    if (!name || !name_he) {
      return res.status(400).json({ error: 'שם הקטגוריה נדרש' });
    }

    const result = db.prepare(`
      INSERT INTO categories (name, name_he, description, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, name_he, description || '', icon || '', sort_order || 0, is_active !== undefined ? is_active : 1);

    const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת קטגוריה' });
  }
});

// Update category
router.put('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { name, name_he, description, icon, sort_order, is_active } = req.body;
    const categoryId = req.params.id;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!existing) {
      return res.status(404).json({ error: 'הקטגוריה לא נמצאה' });
    }

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          name_he = COALESCE(?, name_he),
          description = COALESCE(?, description),
          icon = COALESCE(?, icon),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, name_he, description, icon, sort_order, is_active, categoryId);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    res.json(updated);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון קטגוריה' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const categoryId = req.params.id;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!existing) {
      return res.status(404).json({ error: 'הקטגוריה לא נמצאה' });
    }

    // Check if category is in use
    const inUse = db.prepare('SELECT COUNT(*) as count FROM requests WHERE category_id = ?').get(categoryId);
    if (inUse && inUse.count > 0) {
      // Just deactivate instead of deleting
      db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(categoryId);
      return res.json({ message: 'הקטגוריה הושבתה (לא נמחקה כי נמצאת בשימוש)' });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    res.json({ message: 'הקטגוריה נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת קטגוריה' });
  }
});

module.exports = router;
