const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// Dashboard statistics
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    // Get requests/inquiries stats
    const inquiryStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM inquiries
    `).get() || { total: 0, new_count: 0, in_progress: 0, resolved: 0 };

    // Also check requests table
    const requestStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM requests
    `).get() || { total: 0, new_count: 0, in_progress: 0, resolved: 0 };

    // Combine stats
    const totalInquiries = (inquiryStats.total || 0) + (requestStats.total || 0);
    const openInquiries = (inquiryStats.new_count || 0) + (requestStats.new_count || 0) +
                          (inquiryStats.in_progress || 0) + (requestStats.in_progress || 0);

    // Get meetings stats
    const meetingStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN date > datetime('now') THEN 1 ELSE 0 END) as upcoming,
        SUM(CASE WHEN has_protocol = 1 THEN 1 ELSE 0 END) as with_protocol
      FROM meetings
    `).get() || { total: 0, upcoming: 0, with_protocol: 0 };

    // Get budget stats
    const budgetStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
      FROM transactions
      WHERE strftime('%Y', date) = strftime('%Y', 'now')
    `).get() || { total_income: 0, total_expense: 0 };

    // Get employees count
    const employeeStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM employees
    `).get() || { total: 0, active: 0 };

    // Get projects stats
    const projectStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
      FROM projects
    `).get() || { total: 0, in_progress: 0 };

    // Get pending announcements
    const pendingAnnouncements = db.prepare(`
      SELECT COUNT(*) as count FROM announcements
      WHERE publish_date > datetime('now') OR status = 'draft'
    `).get()?.count || 0;

    // Get upcoming events count
    const upcomingEvents = db.prepare(`
      SELECT COUNT(*) as count FROM events
      WHERE start_date > datetime('now') AND status = 'published'
    `).get()?.count || 0;

    res.json({
      inquiries: {
        total: totalInquiries,
        open: openInquiries,
        new: (inquiryStats.new_count || 0) + (requestStats.new_count || 0),
        resolved: (inquiryStats.resolved || 0) + (requestStats.resolved || 0)
      },
      meetings: {
        total: meetingStats.total || 0,
        upcoming: meetingStats.upcoming || 0,
        withProtocol: meetingStats.with_protocol || 0
      },
      budget: {
        income: budgetStats.total_income || 0,
        expense: budgetStats.total_expense || 0,
        balance: (budgetStats.total_income || 0) - (budgetStats.total_expense || 0)
      },
      employees: {
        total: employeeStats.total || 0,
        active: employeeStats.active || 0
      },
      projects: {
        total: projectStats.total || 0,
        inProgress: projectStats.in_progress || 0
      },
      announcements: {
        pending: pendingAnnouncements
      },
      events: {
        upcoming: upcomingEvents
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני לוח הבקרה' });
  }
});

// Recent activity
router.get('/activity', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;

    // Get recent inquiries
    const recentInquiries = db.prepare(`
      SELECT 'inquiry' as type, id, subject as title, status, created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    // Get recent requests
    const recentRequests = db.prepare(`
      SELECT 'request' as type, id, subject as title, status, created_at
      FROM requests
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    // Get recent meetings
    const recentMeetings = db.prepare(`
      SELECT 'meeting' as type, id, title, date as created_at
      FROM meetings
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    // Combine and sort by date
    const activity = [...recentInquiries, ...recentRequests, ...recentMeetings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json(activity);
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פעילות אחרונה' });
  }
});

// Chart data - inquiries by category
router.get('/charts/inquiries-by-category', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM inquiries
      GROUP BY category
      ORDER BY count DESC
    `).all();

    res.json(data);
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני גרף' });
  }
});

// Chart data - inquiries by status
router.get('/charts/inquiries-by-status', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM inquiries
      GROUP BY status
    `).all();

    res.json(data);
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני גרף' });
  }
});

// Chart data - monthly transactions
router.get('/charts/monthly-transactions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month
    `).all();

    res.json(data);
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני גרף' });
  }
});

module.exports = router;
