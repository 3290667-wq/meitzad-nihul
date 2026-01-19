const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file path - use Render's persistent disk in production if available
// Otherwise fallback to /tmp (note: data will be lost on restart without disk)
const dataDir = process.env.NODE_ENV === 'production'
  ? (process.env.DATA_DIR || '/var/data')
  : path.join(__dirname, '../../data');

const DB_PATH = path.join(dataDir, 'meitzad.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('Database initialized successfully');
}

// Generate unique request number
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

// ==================== Users ====================

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

// ==================== Requests ====================

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

// ==================== Request Updates ====================

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

// ==================== Categories ====================

const getCategories = db.prepare(`
  SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order
`);

// ==================== Statistics ====================

const getRequestStats = db.prepare(`
  SELECT
    status,
    COUNT(*) as count
  FROM requests
  GROUP BY status
`);

const getRequestStatsByCategory = db.prepare(`
  SELECT
    c.name_he as category,
    c.icon,
    COUNT(r.id) as count
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
  SELECT
    AVG(ROUND((julianday(resolved_at) - julianday(created_at)) * 24, 1)) as avg_hours
  FROM requests
  WHERE resolved_at IS NOT NULL
`);

// ==================== Notifications ====================

const createNotification = db.prepare(`
  INSERT INTO notifications (request_id, user_id, type, recipient, subject, content, status)
  VALUES (@request_id, @user_id, @type, @recipient, @subject, @content, @status)
`);

const updateNotificationStatus = db.prepare(`
  UPDATE notifications
  SET status = @status, sent_at = CASE WHEN @status = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END, error = @error
  WHERE id = @id
`);

// ==================== Audit Log ====================

const addAuditLog = db.prepare(`
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
  VALUES (@user_id, @action, @entity_type, @entity_id, @old_values, @new_values, @ip_address)
`);

// ==================== Settings ====================

const getSetting = db.prepare(`
  SELECT value FROM settings WHERE key = ?
`);

const updateSetting = db.prepare(`
  UPDATE settings SET value = @value, updated_at = CURRENT_TIMESTAMP WHERE key = @key
`);

const getAllSettings = db.prepare(`
  SELECT * FROM settings
`);

// Export
module.exports = {
  db,
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
