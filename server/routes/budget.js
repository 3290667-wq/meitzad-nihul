const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get budget summary
router.get('/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const year = req.query.year || new Date().getFullYear();

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
    `).get(String(year));

    const balance = (summary.total_income || 0) - (summary.total_expense || 0);

    // Get previous year for comparison
    const prevYear = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
    `).get(String(year - 1));

    res.json({
      year: parseInt(year),
      income: summary.total_income || 0,
      expense: summary.total_expense || 0,
      balance,
      prevYear: {
        income: prevYear?.total_income || 0,
        expense: prevYear?.total_expense || 0
      }
    });
  } catch (error) {
    console.error('Budget summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיכום תקציב' });
  }
});

// Get all transactions
router.get('/transactions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { type, category, year, month, limit, offset } = req.query;

    let query = `
      SELECT t.*, u.name as created_by_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      query += ` AND t.type = ?`;
      params.push(type);
    }

    if (category && category !== 'all') {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (year) {
      query += ` AND strftime('%Y', t.date) = ?`;
      params.push(String(year));
    }

    if (month) {
      query += ` AND strftime('%m', t.date) = ?`;
      params.push(String(month).padStart(2, '0'));
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
      if (offset) {
        query += ` OFFSET ?`;
        params.push(parseInt(offset));
      }
    }

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תנועות' });
  }
});

// Get single transaction
router.get('/transactions/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const transaction = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'התנועה לא נמצאה' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת התנועה' });
  }
});

// Create transaction
router.post('/transactions', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { type, amount, description, category, date, notes, receipt_number } = req.body;

    if (!type || !amount || !description) {
      return res.status(400).json({ error: 'חסרים שדות חובה' });
    }

    const result = db.prepare(`
      INSERT INTO transactions (type, amount, description, category, date, notes, receipt_number, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type, Math.abs(parseFloat(amount)), description, category || 'other',
      date || new Date().toISOString().split('T')[0], notes, receipt_number, req.user.id
    );

    const newTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('transaction:created', newTransaction);
    }

    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת תנועה' });
  }
});

// Update transaction
router.put('/transactions/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { type, amount, description, category, date, notes, receipt_number } = req.body;

    db.prepare(`
      UPDATE transactions SET
        type = COALESCE(?, type),
        amount = COALESCE(?, amount),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        date = COALESCE(?, date),
        notes = COALESCE(?, notes),
        receipt_number = COALESCE(?, receipt_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      type, amount ? Math.abs(parseFloat(amount)) : null, description, category,
      date, notes, receipt_number, req.params.id
    );

    const updatedTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון התנועה' });
  }
});

// Delete transaction
router.delete('/transactions/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת התנועה' });
  }
});

// Get monthly breakdown
router.get('/monthly', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const year = req.query.year || new Date().getFullYear();

    const data = db.prepare(`
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).all(String(year));

    res.json(data);
  } catch (error) {
    console.error('Monthly breakdown error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתונים חודשיים' });
  }
});

// Get category breakdown
router.get('/by-category', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { year, type } = req.query;

    let query = `
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE 1=1
    `;
    const params = [];

    if (year) {
      query += ` AND strftime('%Y', date) = ?`;
      params.push(String(year));
    }

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` GROUP BY category ORDER BY total DESC`;

    const data = db.prepare(query).all(...params);
    res.json(data);
  } catch (error) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתונים לפי קטגוריה' });
  }
});

module.exports = router;
