const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all employees
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, department } = req.query;

    let query = `SELECT * FROM employees WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    } else {
      query += ` AND status != 'deleted'`;
    }

    if (department && department !== 'all') {
      query += ` AND department = ?`;
      params.push(department);
    }

    query += ` ORDER BY name`;

    const employees = db.prepare(query).all(...params);
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

// Get single employee
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: 'העובד לא נמצא' });
    }

    // Get attendance records
    employee.attendance = db.prepare(`
      SELECT * FROM attendance
      WHERE employee_id = ?
      ORDER BY date DESC
      LIMIT 30
    `).all(employee.id);

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פרטי העובד' });
  }
});

// Create employee
router.post('/', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      id_number, name, position, department, phone, email, address,
      start_date, employment_type, salary, status, notes, send_attendance_notifications
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'שם העובד הוא שדה חובה' });
    }

    const result = db.prepare(`
      INSERT INTO employees (
        id_number, name, position, department, phone, email, address,
        start_date, employment_type, salary, status, notes, send_attendance_notifications, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_number, name, position, department || 'other', phone, email, address,
      start_date, employment_type || 'full_time', salary || 0, status || 'active',
      notes, send_attendance_notifications ? 1 : 0, req.user.id
    );

    const newEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('Create employee error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'מספר תעודת הזהות כבר קיים במערכת' });
    }
    res.status(500).json({ error: 'שגיאה ביצירת עובד' });
  }
});

// Update employee
router.put('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const {
      id_number, name, position, department, phone, email, address,
      start_date, end_date, employment_type, salary, status, notes, send_attendance_notifications
    } = req.body;

    db.prepare(`
      UPDATE employees SET
        id_number = COALESCE(?, id_number),
        name = COALESCE(?, name),
        position = COALESCE(?, position),
        department = COALESCE(?, department),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        start_date = COALESCE(?, start_date),
        end_date = ?,
        employment_type = COALESCE(?, employment_type),
        salary = COALESCE(?, salary),
        status = COALESCE(?, status),
        notes = ?,
        send_attendance_notifications = COALESCE(?, send_attendance_notifications),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      id_number, name, position, department, phone, email, address,
      start_date, end_date, employment_type, salary, status, notes,
      send_attendance_notifications !== undefined ? (send_attendance_notifications ? 1 : 0) : null,
      req.params.id
    );

    const updatedEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון העובד' });
  }
});

// Delete employee (soft delete)
router.delete('/:id', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE employees SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת העובד' });
  }
});

// ==================== ATTENDANCE ====================

// Get attendance for date
router.get('/attendance/date/:date', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { date } = req.params;

    const attendance = db.prepare(`
      SELECT a.*, e.name as employee_name, e.position, e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date = ? AND e.status = 'active'
      ORDER BY e.name
    `).all(date);

    // Get all active employees for comparison
    const allEmployees = db.prepare(`
      SELECT id, name, position, department FROM employees WHERE status = 'active'
    `).all();

    res.json({
      date,
      attendance,
      employees: allEmployees
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נוכחות' });
  }
});

// Record check-in
router.post('/attendance/check-in', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { employee_id, date, time } = req.body;
    const checkInTime = time || new Date().toISOString();
    const attendanceDate = date || new Date().toISOString().split('T')[0];

    // Check if already checked in
    const existing = db.prepare(`
      SELECT * FROM attendance WHERE employee_id = ? AND date = ?
    `).get(employee_id, attendanceDate);

    if (existing) {
      return res.status(400).json({ error: 'העובד כבר נכנס היום' });
    }

    const result = db.prepare(`
      INSERT INTO attendance (employee_id, date, check_in, created_by)
      VALUES (?, ?, ?, ?)
    `).run(employee_id, attendanceDate, checkInTime, req.user.id);

    const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'שגיאה ברישום כניסה' });
  }
});

// Record check-out
router.post('/attendance/check-out', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { employee_id, date, time } = req.body;
    const checkOutTime = time || new Date().toISOString();
    const attendanceDate = date || new Date().toISOString().split('T')[0];

    // Find check-in record
    const existing = db.prepare(`
      SELECT * FROM attendance WHERE employee_id = ? AND date = ?
    `).get(employee_id, attendanceDate);

    if (!existing) {
      return res.status(400).json({ error: 'לא נמצאה כניסה לעובד זה היום' });
    }

    if (existing.check_out) {
      return res.status(400).json({ error: 'העובד כבר יצא היום' });
    }

    // Calculate total hours
    const checkIn = new Date(existing.check_in);
    const checkOut = new Date(checkOutTime);
    const totalHours = (checkOut - checkIn) / (1000 * 60 * 60);

    db.prepare(`
      UPDATE attendance SET check_out = ?, total_hours = ? WHERE id = ?
    `).run(checkOutTime, Math.round(totalHours * 100) / 100, existing.id);

    const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
    res.json(attendance);
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'שגיאה ברישום יציאה' });
  }
});

// Get attendance summary for employee
router.get('/:id/attendance/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { month, year } = req.query;
    const currentMonth = month || (new Date().getMonth() + 1);
    const currentYear = year || new Date().getFullYear();

    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_days,
        SUM(total_hours) as total_hours,
        AVG(total_hours) as avg_hours_per_day
      FROM attendance
      WHERE employee_id = ?
        AND strftime('%Y', date) = ?
        AND strftime('%m', date) = ?
    `).get(req.params.id, String(currentYear), String(currentMonth).padStart(2, '0'));

    res.json({
      employee_id: parseInt(req.params.id),
      month: currentMonth,
      year: currentYear,
      ...summary
    });
  } catch (error) {
    console.error('Attendance summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיכום נוכחות' });
  }
});

// Get payroll summary
router.get('/payroll/summary', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { month, year } = req.query;
    const currentMonth = month || (new Date().getMonth() + 1);
    const currentYear = year || new Date().getFullYear();

    const payroll = db.prepare(`
      SELECT
        e.id, e.name, e.position, e.department, e.salary,
        COALESCE(SUM(a.total_hours), 0) as total_hours,
        COUNT(a.id) as days_worked
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
        AND strftime('%Y', a.date) = ?
        AND strftime('%m', a.date) = ?
      WHERE e.status = 'active'
      GROUP BY e.id
      ORDER BY e.name
    `).all(String(currentYear), String(currentMonth).padStart(2, '0'));

    res.json({
      month: currentMonth,
      year: currentYear,
      employees: payroll
    });
  } catch (error) {
    console.error('Payroll summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני שכר' });
  }
});

module.exports = router;
