const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ==================== EVENTS ====================

// Get all events
router.get('/events', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const events = db.prepare(`
      SELECT e.*, u.name as created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.start_date DESC
    `).all();
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת האירועים' });
  }
});

// Get upcoming events
router.get('/events/upcoming', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;
    const events = db.prepare(`
      SELECT e.*, u.name as created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.start_date >= datetime('now') AND e.status = 'published'
      ORDER BY e.start_date ASC
      LIMIT ?
    `).all(limit);
    res.json(events);
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת האירועים' });
  }
});

// Get single event
router.get('/events/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const event = db.prepare(`
      SELECT e.*, u.name as created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'האירוע לא נמצא' });
    }

    // Get registrations if applicable
    if (event.registration_required) {
      event.registrations = db.prepare(`
        SELECT er.*, u.name as user_name
        FROM event_registrations er
        LEFT JOIN users u ON er.user_id = u.id
        WHERE er.event_id = ? AND er.status != 'cancelled'
      `).all(event.id);
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת האירוע' });
  }
});

// Create event
router.post('/events', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      title, description, event_type, location, start_date, end_date, all_day,
      recurring, recurring_end_date, max_participants, registration_required,
      registration_deadline, cost, status
    } = req.body;

    const result = db.prepare(`
      INSERT INTO events (
        title, description, event_type, location, start_date, end_date, all_day,
        recurring, recurring_end_date, max_participants, registration_required,
        registration_deadline, cost, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description, event_type || 'general', location, start_date, end_date,
      all_day || 0, recurring || 'none', recurring_end_date, max_participants,
      registration_required || 0, registration_deadline, cost || 0, status || 'draft',
      req.user.id
    );

    const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event
    const io = req.app.get('io');
    if (io && newEvent.status === 'published') {
      io.emit('event:created', newEvent);
    }

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת האירוע' });
  }
});

// Update event
router.put('/events/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      title, description, event_type, location, start_date, end_date, all_day,
      recurring, recurring_end_date, max_participants, registration_required,
      registration_deadline, cost, status
    } = req.body;

    db.prepare(`
      UPDATE events SET
        title = ?, description = ?, event_type = ?, location = ?, start_date = ?,
        end_date = ?, all_day = ?, recurring = ?, recurring_end_date = ?,
        max_participants = ?, registration_required = ?, registration_deadline = ?,
        cost = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, description, event_type, location, start_date, end_date, all_day,
      recurring, recurring_end_date, max_participants, registration_required,
      registration_deadline, cost, status, req.params.id
    );

    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון האירוע' });
  }
});

// Delete event
router.delete('/events/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת האירוע' });
  }
});

// Register for event
router.post('/events/:id/register', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'האירוע לא נמצא' });
    }

    if (!event.registration_required) {
      return res.status(400).json({ error: 'האירוע לא דורש הרשמה' });
    }

    // Check max participants
    if (event.max_participants) {
      const currentCount = db.prepare(`
        SELECT SUM(num_guests) as total FROM event_registrations
        WHERE event_id = ? AND status != 'cancelled'
      `).get(event.id);

      if (currentCount.total >= event.max_participants) {
        return res.status(400).json({ error: 'האירוע מלא' });
      }
    }

    const { num_guests, notes } = req.body;

    const result = db.prepare(`
      INSERT INTO event_registrations (event_id, user_id, num_guests, notes)
      VALUES (?, ?, ?, ?)
    `).run(event.id, req.user.id, num_guests || 1, notes);

    // Update current participants count
    db.prepare(`
      UPDATE events SET current_participants = (
        SELECT COALESCE(SUM(num_guests), 0) FROM event_registrations
        WHERE event_id = ? AND status != 'cancelled'
      ) WHERE id = ?
    `).run(event.id, event.id);

    res.status(201).json({ success: true, registration_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Register for event error:', error);
    res.status(500).json({ error: 'שגיאה בהרשמה לאירוע' });
  }
});

// ==================== ANNOUNCEMENTS ====================

// Get all announcements
router.get('/announcements', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const announcements = db.prepare(`
      SELECT a.*, u.name as created_by_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.is_pinned DESC, a.publish_date DESC
    `).all();
    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההודעות' });
  }
});

// Get recent announcements
router.get('/announcements/recent', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 5;
    const announcements = db.prepare(`
      SELECT a.*, u.name as created_by_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE (a.publish_date IS NULL OR a.publish_date <= datetime('now'))
        AND (a.expire_date IS NULL OR a.expire_date > datetime('now'))
      ORDER BY a.is_pinned DESC, a.publish_date DESC
      LIMIT ?
    `).all(limit);
    res.json(announcements);
  } catch (error) {
    console.error('Get recent announcements error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההודעות' });
  }
});

// Get single announcement
router.get('/announcements/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const announcement = db.prepare(`
      SELECT a.*, u.name as created_by_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'ההודעה לא נמצאה' });
    }

    // Increment view count
    db.prepare('UPDATE announcements SET views_count = views_count + 1 WHERE id = ?').run(req.params.id);

    res.json(announcement);
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההודעה' });
  }
});

// Create announcement
router.post('/announcements', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      title, content, type, priority, is_pinned, publish_date, expire_date,
      target_audience, send_notification
    } = req.body;

    const result = db.prepare(`
      INSERT INTO announcements (
        title, content, type, priority, is_pinned, publish_date, expire_date,
        target_audience, send_notification, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, content, type || 'info', priority || 0, is_pinned || 0,
      publish_date || null, expire_date || null, target_audience || 'all',
      send_notification || 0, req.user.id
    );

    const newAnnouncement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement:created', newAnnouncement);
    }

    res.status(201).json(newAnnouncement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ההודעה' });
  }
});

// Update announcement
router.put('/announcements/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      title, content, type, priority, is_pinned, publish_date, expire_date,
      target_audience, send_notification
    } = req.body;

    db.prepare(`
      UPDATE announcements SET
        title = ?, content = ?, type = ?, priority = ?, is_pinned = ?,
        publish_date = ?, expire_date = ?, target_audience = ?,
        send_notification = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, content, type, priority, is_pinned, publish_date, expire_date,
      target_audience, send_notification, req.params.id
    );

    const updatedAnnouncement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון ההודעה' });
  }
});

// Delete announcement
router.delete('/announcements/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת ההודעה' });
  }
});

// ==================== FACILITIES ====================

// Get all facilities
router.get('/facilities', (req, res) => {
  try {
    const db = getDb();
    const facilities = db.prepare('SELECT * FROM facilities WHERE is_active = 1 ORDER BY name').all();
    res.json(facilities);
  } catch (error) {
    console.error('Get facilities error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת המתקנים' });
  }
});

// Get pending bookings
router.get('/facilities/bookings/pending', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare(`
      SELECT fb.*, f.name as facility_name, u.name as user_name
      FROM facility_bookings fb
      JOIN facilities f ON fb.facility_id = f.id
      LEFT JOIN users u ON fb.user_id = u.id
      WHERE fb.status = 'pending'
      ORDER BY fb.booking_date ASC
    `).all();
    res.json(bookings);
  } catch (error) {
    console.error('Get pending bookings error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההזמנות' });
  }
});

// Create booking
router.post('/facilities/:id/book', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);

    if (!facility) {
      return res.status(404).json({ error: 'המתקן לא נמצא' });
    }

    const { booking_date, start_time, end_time, purpose, num_participants } = req.body;

    // Check for conflicts
    const conflict = db.prepare(`
      SELECT * FROM facility_bookings
      WHERE facility_id = ? AND booking_date = ?
        AND status IN ('pending', 'approved')
        AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
    `).get(facility.id, booking_date, end_time, start_time, start_time, end_time);

    if (conflict) {
      return res.status(400).json({ error: 'המתקן תפוס בשעות אלו' });
    }

    const status = facility.requires_approval ? 'pending' : 'approved';

    const result = db.prepare(`
      INSERT INTO facility_bookings (
        facility_id, user_id, booking_date, start_time, end_time,
        purpose, num_participants, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(facility.id, req.user.id, booking_date, start_time, end_time, purpose, num_participants, status);

    const booking = db.prepare('SELECT * FROM facility_bookings WHERE id = ?').get(result.lastInsertRowid);

    // Emit real-time event for pending bookings
    const io = req.app.get('io');
    if (io && status === 'pending') {
      io.emit('booking:created', booking);
    }

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ההזמנה' });
  }
});

// Approve booking
router.post('/facilities/bookings/:id/approve', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE facility_bookings SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({ error: 'שגיאה באישור ההזמנה' });
  }
});

// Reject booking
router.post('/facilities/bookings/:id/reject', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { reason } = req.body;
    db.prepare(`
      UPDATE facility_bookings SET status = 'rejected', admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(reason || null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: 'שגיאה בדחיית ההזמנה' });
  }
});

// ==================== POLLS ====================

// Get active polls
router.get('/polls/active', (req, res) => {
  try {
    const db = getDb();
    const polls = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM poll_votes WHERE poll_id = p.id) as total_votes
      FROM polls p
      WHERE p.status = 'active'
        AND (p.start_date IS NULL OR p.start_date <= datetime('now'))
        AND (p.end_date IS NULL OR p.end_date > datetime('now'))
      ORDER BY p.created_at DESC
    `).all();
    res.json(polls);
  } catch (error) {
    console.error('Get active polls error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסקרים' });
  }
});

// Get all polls (admin)
router.get('/polls', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const polls = db.prepare(`
      SELECT p.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM poll_votes WHERE poll_id = p.id) as total_votes
      FROM polls p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(polls);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסקרים' });
  }
});

// Get poll with options
router.get('/polls/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const poll = db.prepare(`
      SELECT p.*, u.name as created_by_name
      FROM polls p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'הסקר לא נמצא' });
    }

    poll.options = db.prepare(`
      SELECT po.*,
        (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count
      FROM poll_options po
      WHERE po.poll_id = ?
      ORDER BY po.sort_order
    `).all(poll.id);

    // Check if user already voted
    poll.user_voted = db.prepare(`
      SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?
    `).get(poll.id, req.user.id) ? true : false;

    res.json(poll);
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסקר' });
  }
});

// Create poll
router.post('/polls', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      title, description, poll_type, status, start_date, end_date,
      is_anonymous, multiple_choice, show_results, options
    } = req.body;

    const result = db.prepare(`
      INSERT INTO polls (
        title, description, poll_type, status, start_date, end_date,
        is_anonymous, multiple_choice, show_results, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description, poll_type || 'poll', status || 'draft',
      start_date, end_date, is_anonymous || 0, multiple_choice || 0,
      show_results || 1, req.user.id
    );

    const pollId = result.lastInsertRowid;

    // Insert options
    if (options && options.length > 0) {
      const insertOption = db.prepare(`
        INSERT INTO poll_options (poll_id, option_text, description, sort_order)
        VALUES (?, ?, ?, ?)
      `);
      options.forEach((opt, index) => {
        insertOption.run(pollId, opt.text, opt.description || null, index);
      });
    }

    const newPoll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    res.status(201).json(newPoll);
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת הסקר' });
  }
});

// Vote in poll
router.post('/polls/:id/vote', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'הסקר לא נמצא' });
    }

    if (poll.status !== 'active') {
      return res.status(400).json({ error: 'הסקר אינו פעיל' });
    }

    // Check if already voted
    const existingVote = db.prepare('SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(poll.id, req.user.id);
    if (existingVote) {
      return res.status(400).json({ error: 'כבר הצבעת בסקר זה' });
    }

    const { option_ids } = req.body;

    if (!option_ids || !Array.isArray(option_ids) || option_ids.length === 0) {
      return res.status(400).json({ error: 'לא נבחרה אפשרות' });
    }

    const insertVote = db.prepare('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)');
    option_ids.forEach(optionId => {
      insertVote.run(poll.id, optionId, req.user.id);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Vote in poll error:', error);
    res.status(500).json({ error: 'שגיאה בהצבעה' });
  }
});

// ==================== EMERGENCY CONTACTS ====================

router.get('/emergency-contacts', (req, res) => {
  try {
    const db = getDb();
    const contacts = db.prepare(`
      SELECT * FROM emergency_contacts WHERE is_active = 1 ORDER BY sort_order, name
    `).all();
    res.json(contacts);
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אנשי קשר' });
  }
});

// ==================== QUICK LINKS ====================

router.get('/quick-links', (req, res) => {
  try {
    const db = getDb();
    const links = db.prepare(`
      SELECT * FROM quick_links WHERE is_active = 1 ORDER BY sort_order, title
    `).all();
    res.json(links);
  } catch (error) {
    console.error('Get quick links error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת קישורים' });
  }
});

// ==================== DIRECTORY ====================

router.get('/directory', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const entries = db.prepare(`
      SELECT * FROM directory_entries WHERE is_public = 1 ORDER BY category, display_name
    `).all();
    res.json(entries);
  } catch (error) {
    console.error('Get directory error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ספר הטלפונים' });
  }
});

// ==================== DOCUMENTS ====================

router.get('/documents', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const documents = db.prepare(`
      SELECT d.*, u.name as created_by_name
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.is_public = 1 OR ? IN ('super_admin', 'admin')
      ORDER BY d.category, d.title
    `).all(req.user.role);
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת המסמכים' });
  }
});

module.exports = router;
