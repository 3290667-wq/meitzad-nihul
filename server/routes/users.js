const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const {
  db,
  getAllUsers,
  getUserById,
  createUser,
  getUserByEmail,
  addAuditLog
} = require('../database/db');

const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/auth');

// GET /api/users - Get all users (admin only)
router.get('/', isAdmin, (req, res) => {
  try {
    const users = getAllUsers.all();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת המשתמשים' });
  }
});

// GET /api/users/staff - Get staff members (for assignment dropdown)
router.get('/staff', isAdmin, (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE role IN ('super_admin', 'admin', 'staff') AND is_active = 1
      ORDER BY name
    `).all();

    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת רשימת הצוות' });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', isAdmin, (req, res) => {
  try {
    const user = getUserById.get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת המשתמש' });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { email, password, name, phone, address, role } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'נא למלא את כל השדות הנדרשים (אימייל, סיסמה, שם)'
      });
    }

    // Check role permission - only super_admin can create admins
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'אין הרשאה ליצור מנהל ראשי'
      });
    }

    // Check if user exists
    const existingUser = getUserByEmail.get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'משתמש עם אימייל זה כבר קיים' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = createUser.run({
      email,
      password: hashedPassword,
      name,
      phone: phone || null,
      address: address || null,
      role: role || 'citizen'
    });

    // Log audit
    addAuditLog.run({
      user_id: req.user.id,
      action: 'USER_CREATED',
      entity_type: 'user',
      entity_id: result.lastInsertRowid,
      old_values: null,
      new_values: JSON.stringify({ email, name, role }),
      ip_address: req.ip
    });

    const user = getUserById.get(result.lastInsertRowid);

    res.status(201).json({
      message: 'המשתמש נוצר בהצלחה',
      user
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת המשתמש' });
  }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', isAdmin, async (req, res) => {
  try {
    const { name, phone, address, role, is_active } = req.body;
    const userId = parseInt(req.params.id);

    const user = getUserById.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Check role permission
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'אין הרשאה להגדיר כמנהל ראשי'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'לא סופקו שדות לעדכון' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Log audit
    addAuditLog.run({
      user_id: req.user.id,
      action: 'USER_UPDATED',
      entity_type: 'user',
      entity_id: userId,
      old_values: JSON.stringify({ name: user.name, role: user.role }),
      new_values: JSON.stringify(req.body),
      ip_address: req.ip
    });

    const updatedUser = getUserById.get(userId);
    res.json({
      message: 'המשתמש עודכן בהצלחה',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון המשתמש' });
  }
});

// PATCH /api/users/:id/reset-password - Reset user password (admin only)
router.patch('/:id/reset-password', isSuperAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = parseInt(req.params.id);

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'הסיסמה חייבת להכיל לפחות 6 תווים'
      });
    }

    const user = getUserById.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, userId);

    // Log audit
    addAuditLog.run({
      user_id: req.user.id,
      action: 'PASSWORD_RESET',
      entity_type: 'user',
      entity_id: userId,
      old_values: null,
      new_values: null,
      ip_address: req.ip
    });

    res.json({ message: 'הסיסמה אופסה בהצלחה' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'שגיאה באיפוס הסיסמה' });
  }
});

// DELETE /api/users/:id - Delete user (deactivate)
router.delete('/:id', isSuperAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש שלך' });
    }

    const user = getUserById.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Soft delete - deactivate
    db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(userId);

    // Log audit
    addAuditLog.run({
      user_id: req.user.id,
      action: 'USER_DELETED',
      entity_type: 'user',
      entity_id: userId,
      old_values: JSON.stringify({ email: user.email, name: user.name }),
      new_values: null,
      ip_address: req.ip
    });

    res.json({ message: 'המשתמש הושבת בהצלחה' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת המשתמש' });
  }
});

module.exports = router;
