const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all meetings
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { type, upcoming } = req.query;

    let query = `
      SELECT m.*, u.name as created_by_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      query += ` AND m.type = ?`;
      params.push(type);
    }

    if (upcoming === 'true') {
      query += ` AND m.date >= datetime('now')`;
    }

    query += ` ORDER BY m.date DESC`;

    const meetings = db.prepare(query).all(...params);
    res.json(meetings);
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ישיבות' });
  }
});

// Get upcoming meetings
router.get('/upcoming', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 5;

    const meetings = db.prepare(`
      SELECT m.*, u.name as created_by_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.date >= datetime('now')
      ORDER BY m.date ASC
      LIMIT ?
    `).all(limit);

    res.json(meetings);
  } catch (error) {
    console.error('Get upcoming meetings error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ישיבות קרובות' });
  }
});

// Get single meeting
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const meeting = db.prepare(`
      SELECT m.*, u.name as created_by_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = ?
    `).get(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: 'הישיבה לא נמצאה' });
    }

    // Get protocol if exists
    if (meeting.has_protocol) {
      meeting.protocol = db.prepare(`
        SELECT * FROM protocols WHERE meeting_id = ?
      `).get(meeting.id);
    }

    res.json(meeting);
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הישיבה' });
  }
});

// Create meeting
router.post('/', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { title, type, date, location, agenda, participants } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'כותרת ותאריך הם שדות חובה' });
    }

    const result = db.prepare(`
      INSERT INTO meetings (title, type, date, location, agenda, participants, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, type || 'regular', date, location, agenda,
      typeof participants === 'string' ? participants : JSON.stringify(participants || []),
      req.user.id
    );

    const newMeeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('meeting:created', newMeeting);
    }

    res.status(201).json(newMeeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ישיבה' });
  }
});

// Update meeting
router.put('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { title, type, date, location, agenda, participants } = req.body;

    db.prepare(`
      UPDATE meetings SET
        title = COALESCE(?, title),
        type = COALESCE(?, type),
        date = COALESCE(?, date),
        location = ?,
        agenda = ?,
        participants = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, type, date, location, agenda,
      typeof participants === 'string' ? participants : JSON.stringify(participants || []),
      req.params.id
    );

    const updatedMeeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    res.json(updatedMeeting);
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הישיבה' });
  }
});

// Delete meeting
router.delete('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת הישיבה' });
  }
});

// ==================== PROTOCOLS ====================

// Get all protocols
router.get('/protocols/all', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const protocols = db.prepare(`
      SELECT p.*, m.title as meeting_title, u.name as created_by_name
      FROM protocols p
      LEFT JOIN meetings m ON p.meeting_id = m.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.meeting_date DESC
    `).all();

    res.json(protocols);
  } catch (error) {
    console.error('Get protocols error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פרוטוקולים' });
  }
});

// Get single protocol
router.get('/protocols/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const protocol = db.prepare(`
      SELECT p.*, m.title as meeting_title, u.name as created_by_name
      FROM protocols p
      LEFT JOIN meetings m ON p.meeting_id = m.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!protocol) {
      return res.status(404).json({ error: 'הפרוטוקול לא נמצא' });
    }

    res.json(protocol);
  } catch (error) {
    console.error('Get protocol error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפרוטוקול' });
  }
});

// Create protocol
router.post('/protocols', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { meeting_id, meeting_date, meeting_type, participants, content, audio_file, status } = req.body;

    const result = db.prepare(`
      INSERT INTO protocols (meeting_id, meeting_date, meeting_type, participants, content, audio_file, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meeting_id || null, meeting_date, meeting_type,
      typeof participants === 'string' ? participants : JSON.stringify(participants || []),
      content, audio_file, status || 'processing', req.user.id
    );

    // Update meeting has_protocol flag
    if (meeting_id) {
      db.prepare('UPDATE meetings SET has_protocol = 1 WHERE id = ?').run(meeting_id);
    }

    const newProtocol = db.prepare('SELECT * FROM protocols WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newProtocol);
  } catch (error) {
    console.error('Create protocol error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת פרוטוקול' });
  }
});

// Update protocol
router.put('/protocols/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { meeting_date, meeting_type, participants, content, status } = req.body;

    db.prepare(`
      UPDATE protocols SET
        meeting_date = COALESCE(?, meeting_date),
        meeting_type = COALESCE(?, meeting_type),
        participants = COALESCE(?, participants),
        content = COALESCE(?, content),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      meeting_date, meeting_type,
      typeof participants === 'string' ? participants : JSON.stringify(participants || []),
      content, status, req.params.id
    );

    const updatedProtocol = db.prepare('SELECT * FROM protocols WHERE id = ?').get(req.params.id);
    res.json(updatedProtocol);
  } catch (error) {
    console.error('Update protocol error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הפרוטוקול' });
  }
});

// Delete protocol
router.delete('/protocols/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const protocol = db.prepare('SELECT meeting_id FROM protocols WHERE id = ?').get(req.params.id);

    db.prepare('DELETE FROM protocols WHERE id = ?').run(req.params.id);

    // Update meeting has_protocol flag if associated
    if (protocol?.meeting_id) {
      db.prepare('UPDATE meetings SET has_protocol = 0 WHERE id = ?').run(protocol.meeting_id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete protocol error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת הפרוטוקול' });
  }
});

module.exports = router;
