const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Helper to generate inquiry number
function generateInquiryNumber(db) {
  const year = new Date().getFullYear();
  const prefix = `INQ-${year}-`;
  const last = db.prepare(`
    SELECT inquiry_number FROM inquiries
    WHERE inquiry_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  if (last) {
    const lastNum = parseInt(last.inquiry_number.split('-')[2]);
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

// Get all inquiries
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, category, search, limit, offset } = req.query;

    let query = `
      SELECT i.*, u.name as assigned_name
      FROM inquiries i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (category && category !== 'all') {
      query += ` AND i.category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (i.subject LIKE ? OR i.name LIKE ? OR i.inquiry_number LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY i.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
      if (offset) {
        query += ` OFFSET ?`;
        params.push(parseInt(offset));
      }
    }

    const inquiries = db.prepare(query).all(...params);
    res.json(inquiries);
  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפניות' });
  }
});

// Get single inquiry
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const inquiry = db.prepare(`
      SELECT i.*, u.name as assigned_name
      FROM inquiries i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ error: 'הפנייה לא נמצאה' });
    }

    // Get updates
    inquiry.updates = db.prepare(`
      SELECT iu.*, u.name as created_by_name
      FROM inquiry_updates iu
      LEFT JOIN users u ON iu.created_by = u.id
      WHERE iu.inquiry_id = ?
      ORDER BY iu.created_at DESC
    `).all(inquiry.id);

    res.json(inquiry);
  } catch (error) {
    console.error('Get inquiry error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפנייה' });
  }
});

// Create inquiry
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      name, email, phone, address, subject, description, category, priority, source
    } = req.body;

    const inquiry_number = generateInquiryNumber(db);

    const result = db.prepare(`
      INSERT INTO inquiries (
        inquiry_number, name, email, phone, address, subject, description,
        category, priority, source, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(
      inquiry_number, name, email, phone, address, subject, description,
      category || 'other', priority || 'normal', source || 'web'
    );

    const newInquiry = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('inquiry:created', newInquiry);
    }

    res.status(201).json(newInquiry);
  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת הפנייה' });
  }
});

// Update inquiry
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const {
      name, email, phone, address, subject, description, category, priority,
      status, assigned_to, note
    } = req.body;

    // Get current inquiry for update tracking
    const current = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);
    if (!current) {
      return res.status(404).json({ error: 'הפנייה לא נמצאה' });
    }

    // Update inquiry
    db.prepare(`
      UPDATE inquiries SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        subject = COALESCE(?, subject),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        updated_at = CURRENT_TIMESTAMP,
        resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = ?
    `).run(
      name, email, phone, address, subject, description, category, priority,
      status, assigned_to, status, req.params.id
    );

    // Add update record if note provided or status changed
    if (note || (status && status !== current.status)) {
      db.prepare(`
        INSERT INTO inquiry_updates (inquiry_id, status, note, created_by)
        VALUES (?, ?, ?, ?)
      `).run(req.params.id, status || current.status, note, req.user.id);
    }

    const updatedInquiry = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('inquiry:updated', updatedInquiry);
    }

    res.json(updatedInquiry);
  } catch (error) {
    console.error('Update inquiry error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הפנייה' });
  }
});

// Delete inquiry
router.delete('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת הפנייה' });
  }
});

// Add update/comment to inquiry
router.post('/:id/updates', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, note } = req.body;

    const result = db.prepare(`
      INSERT INTO inquiry_updates (inquiry_id, status, note, created_by)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, status, note, req.user.id);

    // Update inquiry status if provided
    if (status) {
      db.prepare(`
        UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(status, req.params.id);
    }

    const update = db.prepare(`
      SELECT iu.*, u.name as created_by_name
      FROM inquiry_updates iu
      LEFT JOIN users u ON iu.created_by = u.id
      WHERE iu.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(update);
  } catch (error) {
    console.error('Add update error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת עדכון' });
  }
});

// Get statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
      FROM inquiries
    `).get();

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM inquiries
      GROUP BY category
    `).all();

    const avgResolutionTime = db.prepare(`
      SELECT AVG(ROUND((julianday(resolved_at) - julianday(created_at)) * 24, 1)) as avg_hours
      FROM inquiries
      WHERE resolved_at IS NOT NULL
    `).get();

    res.json({
      ...stats,
      byCategory,
      avgResolutionTime: avgResolutionTime?.avg_hours || 0
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

module.exports = router;
