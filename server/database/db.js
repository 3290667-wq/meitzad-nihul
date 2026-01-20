const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ============================================================
// DATABASE CONFIGURATION FOR RENDER DEPLOYMENT
// ============================================================

console.log('=== Database Module Loading ===');
console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);

// Determine the data directory based on environment
function getDataDir() {
  // Development: use local data folder
  if (process.env.NODE_ENV !== 'production') {
    const devDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }
    console.log(`Development mode - using: ${devDir}`);
    return devDir;
  }

  // Production: try different locations in order of preference
  const locations = [
    process.env.DATA_DIR,           // Custom env var
    '/var/data',                     // Render persistent disk
    '/tmp/meitzad-data'              // Fallback to tmp
  ].filter(Boolean);

  for (const dir of locations) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test write permission
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`Using data directory: ${dir}`);
      if (dir === '/tmp/meitzad-data') {
        console.warn('⚠️  WARNING: Using /tmp - data will be lost on restart!');
      }
      return dir;
    } catch (e) {
      console.log(`Cannot use ${dir}: ${e.message}`);
    }
  }

  throw new Error('No writable data directory available');
}

// Initialize data directory and database path
const dataDir = getDataDir();
const DB_PATH = path.join(dataDir, 'meitzad.db');
console.log(`Database path: ${DB_PATH}`);

// ============================================================
// DATABASE CONNECTION
// ============================================================

let db;
try {
  db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  console.log('✓ Database connection established');
} catch (error) {
  console.error('FATAL: Failed to create database:', error);
  process.exit(1);
}

// ============================================================
// SCHEMA INITIALIZATION
// ============================================================

function initializeSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`Loading schema from: ${schemaPath}`);

  // Check if schema file exists
  if (!fs.existsSync(schemaPath)) {
    console.error(`FATAL: Schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  // Read schema file
  let schema;
  try {
    schema = fs.readFileSync(schemaPath, 'utf8');
    console.log(`✓ Schema file loaded (${schema.length} bytes)`);
  } catch (error) {
    console.error('FATAL: Cannot read schema file:', error);
    process.exit(1);
  }

  // Execute schema
  try {
    db.exec(schema);
    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('FATAL: Schema execution failed:', error);
    process.exit(1);
  }

  // Add reset_token columns if they don't exist
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasResetToken = columns.some(c => c.name === 'reset_token');
    if (!hasResetToken) {
      db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT');
      db.exec('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME');
      console.log('✓ Added password reset columns');
    }
  } catch (e) {
    // Columns might already exist, that's OK
  }
}

// Initialize schema immediately when module loads
initializeSchema();

// ============================================================
// SUPER ADMIN INITIALIZATION
// ============================================================

function initializeSuperAdmin() {
  const bcrypt = require('bcryptjs');
  const superAdminEmail = '3290667@gmail.com';
  const defaultPassword = '12345678';

  try {
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(superAdminEmail);
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(defaultPassword, salt);

    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO users (email, password, name, phone, role, is_active)
        VALUES (?, ?, ?, ?, 'super_admin', 1)
      `).run(superAdminEmail, hashedPassword, 'מנהל ראשי', '');
      console.log('✓ Super admin created: ' + superAdminEmail);
    } else {
      db.prepare('UPDATE users SET role = ?, password = ?, is_active = 1 WHERE email = ?')
        .run('super_admin', hashedPassword, superAdminEmail);
      console.log('✓ Super admin verified: ' + superAdminEmail);
    }
  } catch (error) {
    console.error('FATAL: Super admin initialization failed:', error);
    process.exit(1);
  }
}

// ============================================================
// PUBLIC API
// ============================================================

function initializeDatabase() {
  console.log('Completing database initialization...');
  initializeSuperAdmin();
  console.log('✓ Database fully initialized');
}

function getDb() {
  return db;
}

function generateRequestNumber() {
  const year = new Date().getFullYear();
  const prefix = `M${year}-`;

  const stmt = db.prepare(`
    SELECT request_number FROM requests
    WHERE request_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `);

  const lastRequest = stmt.get(`${prefix}%`);

  if (lastRequest) {
    const lastNum = parseInt(lastRequest.request_number.split('-')[1]);
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  return `${prefix}0001`;
}

// ============================================================
// PREPARED STATEMENTS - USERS
// ============================================================

const createUser = db.prepare(`
  INSERT INTO users (email, password, name, phone, address, role)
  VALUES (@email, @password, @name, @phone, @address, @role)
`);

const getUserByEmail = db.prepare(`
  SELECT * FROM users WHERE email = ? AND is_active = 1
`);

const getUserById = db.prepare(`
  SELECT id, email, name, phone, address, role, created_at, last_login
  FROM users WHERE id = ? AND is_active = 1
`);

const updateUserLastLogin = db.prepare(`
  UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
`);

const getAllUsers = db.prepare(`
  SELECT id, email, name, phone, role, is_active, created_at, last_login
  FROM users ORDER BY name
`);

// ============================================================
// PREPARED STATEMENTS - REQUESTS
// ============================================================

const createRequest = db.prepare(`
  INSERT INTO requests (
    request_number, user_id, submitter_name, submitter_email, submitter_phone,
    submitter_address, preferred_contact, category_id, subject, description,
    location, priority, source
  ) VALUES (
    @request_number, @user_id, @submitter_name, @submitter_email, @submitter_phone,
    @submitter_address, @preferred_contact, @category_id, @subject, @description,
    @location, @priority, @source
  )
`);

const getRequestById = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon,
         u.name as assigned_name
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  LEFT JOIN users u ON r.assigned_to = u.id
  WHERE r.id = ?
`);

const getRequestByNumber = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon,
         u.name as assigned_name
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  LEFT JOIN users u ON r.assigned_to = u.id
  WHERE r.request_number = ?
`);

const getRequestsByUser = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  WHERE r.user_id = ? OR r.submitter_email = ?
  ORDER BY r.created_at DESC
`);

const getRequestsByStatus = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon,
         u.name as assigned_name
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  LEFT JOIN users u ON r.assigned_to = u.id
  WHERE r.status = ?
  ORDER BY r.created_at DESC
`);

const getAllRequests = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon,
         u.name as assigned_name
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  LEFT JOIN users u ON r.assigned_to = u.id
  ORDER BY r.created_at DESC
`);

const updateRequestStatus = db.prepare(`
  UPDATE requests
  SET status = @status,
      updated_at = CURRENT_TIMESTAMP,
      resolved_at = CASE WHEN @status = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
      closed_at = CASE WHEN @status = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END
  WHERE id = @id
`);

const assignRequest = db.prepare(`
  UPDATE requests
  SET assigned_to = @assigned_to,
      status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

// ============================================================
// PREPARED STATEMENTS - REQUEST UPDATES
// ============================================================

const addRequestUpdate = db.prepare(`
  INSERT INTO request_updates (request_id, user_id, action, comment, is_public)
  VALUES (@request_id, @user_id, @action, @comment, @is_public)
`);

const getRequestUpdates = db.prepare(`
  SELECT ru.*, u.name as user_name
  FROM request_updates ru
  LEFT JOIN users u ON ru.user_id = u.id
  WHERE ru.request_id = ?
  ORDER BY ru.created_at ASC
`);

// ============================================================
// PREPARED STATEMENTS - CATEGORIES
// ============================================================

const getCategories = db.prepare(`
  SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order
`);

// ============================================================
// PREPARED STATEMENTS - STATISTICS
// ============================================================

const getRequestStats = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM requests
  GROUP BY status
`);

const getRequestStatsByCategory = db.prepare(`
  SELECT c.name_he as category, c.icon, COUNT(r.id) as count
  FROM categories c
  LEFT JOIN requests r ON c.id = r.category_id
  WHERE c.is_active = 1
  GROUP BY c.id
  ORDER BY count DESC
`);

const getRecentRequests = db.prepare(`
  SELECT r.*, c.name_he as category_name, c.icon as category_icon
  FROM requests r
  LEFT JOIN categories c ON r.category_id = c.id
  ORDER BY r.created_at DESC
  LIMIT ?
`);

const getAverageResolutionTime = db.prepare(`
  SELECT AVG(ROUND((julianday(resolved_at) - julianday(created_at)) * 24, 1)) as avg_hours
  FROM requests
  WHERE resolved_at IS NOT NULL
`);

// ============================================================
// PREPARED STATEMENTS - NOTIFICATIONS
// ============================================================

const createNotification = db.prepare(`
  INSERT INTO notifications (request_id, user_id, type, recipient, subject, content, status)
  VALUES (@request_id, @user_id, @type, @recipient, @subject, @content, @status)
`);

const updateNotificationStatus = db.prepare(`
  UPDATE notifications
  SET status = @status, sent_at = CASE WHEN @status = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END, error = @error
  WHERE id = @id
`);

// ============================================================
// PREPARED STATEMENTS - AUDIT LOG
// ============================================================

const addAuditLog = db.prepare(`
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
  VALUES (@user_id, @action, @entity_type, @entity_id, @old_values, @new_values, @ip_address)
`);

// ============================================================
// PREPARED STATEMENTS - SETTINGS
// ============================================================

const getSetting = db.prepare(`
  SELECT value FROM settings WHERE key = ?
`);

const updateSetting = db.prepare(`
  UPDATE settings SET value = @value, updated_at = CURRENT_TIMESTAMP WHERE key = @key
`);

const getAllSettings = db.prepare(`
  SELECT * FROM settings
`);

console.log('=== Database Module Loaded Successfully ===');

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  db,
  getDb,
  initializeDatabase,
  generateRequestNumber,

  // Users
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  getAllUsers,

  // Requests
  createRequest,
  getRequestById,
  getRequestByNumber,
  getRequestsByUser,
  getRequestsByStatus,
  getAllRequests,
  updateRequestStatus,
  assignRequest,

  // Request Updates
  addRequestUpdate,
  getRequestUpdates,

  // Categories
  getCategories,

  // Statistics
  getRequestStats,
  getRequestStatsByCategory,
  getRecentRequests,
  getAverageResolutionTime,

  // Notifications
  createNotification,
  updateNotificationStatus,

  // Audit
  addAuditLog,

  // Settings
  getSetting,
  updateSetting,
  getAllSettings
};
