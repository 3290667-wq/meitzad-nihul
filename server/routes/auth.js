const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  addAuditLog
} = require('../database/db');

const { generateToken, isAuthenticated } = require('../middleware/auth');

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, address } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'נא למלא את כל השדות הנדרשים (אימייל, סיסמה, שם)'
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
      role: 'citizen' // Default role
    });

    // Log audit
    addAuditLog.run({
      user_id: result.lastInsertRowid,
      action: 'USER_REGISTERED',
      entity_type: 'user',
      entity_id: result.lastInsertRowid,
      old_values: null,
      new_values: JSON.stringify({ email, name }),
      ip_address: req.ip
    });

    // Generate token
    const user = getUserById.get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({
      message: 'המשתמש נוצר בהצלחה',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת המשתמש' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'נא להזין אימייל וסיסמה' });
    }

    // Find user
    const user = getUserByEmail.get(email);
    if (!user) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    // Update last login
    updateUserLastLogin.run(user.id);

    // Log audit
    addAuditLog.run({
      user_id: user.id,
      action: 'USER_LOGIN',
      entity_type: 'user',
      entity_id: user.id,
      old_values: null,
      new_values: null,
      ip_address: req.ip
    });

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'התחברת בהצלחה',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', isAuthenticated, (req, res) => {
  try {
    const user = getUserById.get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פרטי המשתמש' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'נא להזין כתובת אימייל' });
    }

    // Find user
    const user = getUserByEmail.get(email);
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'אם האימייל קיים במערכת, נשלח אליך קישור לאיפוס סיסמה' });
    }

    // Generate reset token (simple version - in production use crypto)
    const resetToken = Math.random().toString(36).substring(2, 15) +
                       Math.random().toString(36).substring(2, 15) +
                       Date.now().toString(36);
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to database
    const { db } = require('../database/db');
    db.prepare(`
      UPDATE users
      SET reset_token = ?, reset_token_expires = ?
      WHERE id = ?
    `).run(resetToken, resetExpires.toISOString(), user.id);

    // Log audit
    addAuditLog.run({
      user_id: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity_type: 'user',
      entity_id: user.id,
      old_values: null,
      new_values: JSON.stringify({ email }),
      ip_address: req.ip
    });

    // In production, send email with reset link
    // For now, just log the token
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({ message: 'אם האימייל קיים במערכת, נשלח אליך קישור לאיפוס סיסמה' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'שגיאה בבקשת איפוס סיסמה' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }

    // Find user by reset token
    const { db } = require('../database/db');
    const user = db.prepare(`
      SELECT * FROM users
      WHERE reset_token = ? AND reset_token_expires > datetime('now')
    `).get(token);

    if (!user) {
      return res.status(400).json({ error: 'קישור איפוס לא תקין או פג תוקף' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    db.prepare(`
      UPDATE users
      SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hashedPassword, user.id);

    // Log audit
    addAuditLog.run({
      user_id: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity_type: 'user',
      entity_id: user.id,
      old_values: null,
      new_values: null,
      ip_address: req.ip
    });

    res.json({ message: 'הסיסמה אופסה בהצלחה. ניתן להתחבר עם הסיסמה החדשה.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'שגיאה באיפוס הסיסמה' });
  }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }

    // Get user with password
    const user = getUserByEmail.get(req.user.email);

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    const { db } = require('../database/db');
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, user.id);

    // Log audit
    addAuditLog.run({
      user_id: user.id,
      action: 'PASSWORD_CHANGED',
      entity_type: 'user',
      entity_id: user.id,
      old_values: null,
      new_values: null,
      ip_address: req.ip
    });

    res.json({ message: 'הסיסמה שונתה בהצלחה' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאה בשינוי הסיסמה' });
  }
});

module.exports = router;
