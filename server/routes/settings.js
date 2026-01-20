const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { getDb } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { createBackup, listBackups, restoreBackup } = require('../services/backup');

// Get all settings
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings').all();

    // Convert to object for easier access
    const settingsObj = {};
    settings.forEach(s => {
      try {
        settingsObj[s.key] = JSON.parse(s.value);
      } catch {
        settingsObj[s.key] = s.value;
      }
    });

    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הגדרות' });
  }
});

// Get specific setting
router.get('/:key', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

    if (!setting) {
      return res.status(404).json({ error: 'ההגדרה לא נמצאה' });
    }

    try {
      setting.value = JSON.parse(setting.value);
    } catch {
      // Keep as string if not valid JSON
    }

    res.json(setting);
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההגדרה' });
  }
});

// Update setting
router.put('/:key', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const { value, description } = req.body;

    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Check if setting exists
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

    if (existing) {
      db.prepare(`
        UPDATE settings SET value = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `).run(valueStr, description, req.params.key);
    } else {
      db.prepare(`
        INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
      `).run(req.params.key, valueStr, description);
    }

    res.json({ success: true, key: req.params.key, value });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון ההגדרה' });
  }
});

// Bulk update settings
router.post('/bulk', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const db = getDb();
    const settings = req.body;

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (@key, @value, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = CURRENT_TIMESTAMP
    `);

    const updateMany = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        upsert.run({ key, value: valueStr });
      }
    });

    updateMany(settings);

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk update settings error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הגדרות' });
  }
});

// Get system settings (public info)
router.get('/system/info', (req, res) => {
  try {
    const db = getDb();

    const siteName = db.prepare('SELECT value FROM settings WHERE key = ?').get('site_name');

    res.json({
      siteName: siteName?.value || 'יישוב מיצד'
    });
  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מידע מערכת' });
  }
});

// Export data
router.get('/export', authenticateToken, requireRole(['super_admin']), (req, res) => {
  try {
    const db = getDb();

    const exportData = {
      exportDate: new Date().toISOString(),
      inquiries: db.prepare('SELECT * FROM inquiries').all(),
      requests: db.prepare('SELECT * FROM requests').all(),
      meetings: db.prepare('SELECT * FROM meetings').all(),
      protocols: db.prepare('SELECT * FROM protocols').all(),
      employees: db.prepare('SELECT * FROM employees').all(),
      transactions: db.prepare('SELECT * FROM transactions').all(),
      projects: db.prepare('SELECT * FROM projects').all(),
      events: db.prepare('SELECT * FROM events').all(),
      announcements: db.prepare('SELECT * FROM announcements').all(),
      settings: db.prepare('SELECT * FROM settings').all()
    };

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'שגיאה בייצוא נתונים' });
  }
});

// Import data
router.post('/import', authenticateToken, requireRole(['super_admin']), (req, res) => {
  try {
    const db = getDb();
    const data = req.body;

    // This is a simplified import - in production you'd want more validation
    const importTransaction = db.transaction((importData) => {
      // Import settings
      if (importData.settings) {
        const upsertSetting = db.prepare(`
          INSERT INTO settings (key, value) VALUES (@key, @value)
          ON CONFLICT(key) DO UPDATE SET value = @value
        `);
        for (const s of importData.settings) {
          upsertSetting.run(s);
        }
      }

      // Add more import logic for other tables as needed
    });

    importTransaction(data);

    res.json({ success: true, message: 'הנתונים יובאו בהצלחה' });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'שגיאה בייבוא נתונים' });
  }
});

// User preferences (per user)
router.get('/user/preferences', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const prefs = db.prepare(`
      SELECT value FROM settings WHERE key = ?
    `).get(`user_prefs_${req.user.id}`);

    if (prefs) {
      try {
        res.json(JSON.parse(prefs.value));
      } catch {
        res.json({});
      }
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת העדפות' });
  }
});

// Update user preferences
router.put('/user/preferences', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const key = `user_prefs_${req.user.id}`;
    const value = JSON.stringify(req.body);

    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);

    res.json({ success: true });
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון העדפות' });
  }
});

// ========== BACKUP MANAGEMENT ==========

// Get list of backups
router.get('/backups', authenticateToken, requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const backups = listBackups();
    res.json(backups);
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת רשימת גיבויים' });
  }
});

// Create manual backup
router.post('/backup', authenticateToken, requireRole(['super_admin']), (req, res) => {
  try {
    const backupPath = createBackup(true);
    if (backupPath) {
      res.json({ success: true, path: backupPath });
    } else {
      res.status(500).json({ success: false, error: 'יצירת הגיבוי נכשלה' });
    }
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת גיבוי' });
  }
});

// Download specific backup
router.get('/backups/:filename', authenticateToken, requireRole(['super_admin']), (req, res) => {
  try {
    const filename = req.params.filename;
    // Sanitize filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'שם קובץ לא חוקי' });
    }

    const dataDir = process.env.NODE_ENV === 'production'
      ? (fs.existsSync('/var/data') ? '/var/data' : '/tmp/meitzad-data')
      : path.join(__dirname, '../../data');
    const backupPath = path.join(dataDir, 'backups', filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'קובץ הגיבוי לא נמצא' });
    }

    res.download(backupPath, filename);
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: 'שגיאה בהורדת גיבוי' });
  }
});

// Restore from backup
router.post('/restore', authenticateToken, requireRole(['super_admin']), (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'לא צוין קובץ גיבוי' });
    }

    // Sanitize filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'שם קובץ לא חוקי' });
    }

    const success = restoreBackup(filename);
    if (success) {
      res.json({ success: true, message: 'השחזור הושלם בהצלחה' });
    } else {
      res.status(500).json({ success: false, error: 'השחזור נכשל' });
    }
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'שגיאה בשחזור גיבוי' });
  }
});

// ========== EMAIL TEST ==========

// Test email connection
router.post('/test-email', authenticateToken, requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const db = getDb();

    // Get SMTP settings from database
    const getSetting = (key) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row?.value || null;
    };

    const smtpHost = getSetting('smtp_host') || process.env.SMTP_HOST;
    const smtpPort = getSetting('smtp_port') || process.env.SMTP_PORT || 587;
    const smtpUser = getSetting('outgoing_email') || process.env.SMTP_USER;
    const smtpPass = getSetting('smtp_pass') || process.env.SMTP_PASS;
    const smtpSecure = getSetting('smtp_secure') === 'true' || process.env.SMTP_SECURE === 'true';

    if (!smtpHost || !smtpUser) {
      return res.json({ success: false, error: 'הגדרות SMTP חסרות' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      auth: smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      connectionTimeout: 10000
    });

    await transporter.verify();
    res.json({ success: true });
  } catch (error) {
    console.error('Test email error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ========== WHATSAPP TEST ==========

// Test WhatsApp connection
router.post('/test-whatsapp', authenticateToken, requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { bridgeUrl } = req.body;
    const url = bridgeUrl || process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3001';

    // Try to connect to the WhatsApp bridge
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${url}/api/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        res.json({ connected: data.connected || data.status === 'connected' });
      } else {
        res.json({ connected: false });
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      res.json({ connected: false, error: fetchError.message });
    }
  } catch (error) {
    console.error('Test WhatsApp error:', error);
    res.json({ connected: false, error: error.message });
  }
});

module.exports = router;
