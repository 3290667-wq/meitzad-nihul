-- Schema for Meitzad Community Management System
-- Database: SQLite

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    role TEXT DEFAULT 'citizen' CHECK(role IN ('super_admin', 'admin', 'staff', 'citizen')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Request categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_he TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

-- Requests (פניות) table
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),

    -- Submitter info (for non-registered users)
    submitter_name TEXT,
    submitter_email TEXT,
    submitter_phone TEXT,
    submitter_address TEXT,
    preferred_contact TEXT DEFAULT 'email',

    -- Request details
    category_id INTEGER REFERENCES categories(id),
    subject TEXT NOT NULL,
    description TEXT,
    location TEXT,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),

    -- Status tracking
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'pending', 'resolved', 'closed')),
    assigned_to INTEGER REFERENCES users(id),

    -- Source tracking
    source TEXT DEFAULT 'web' CHECK(source IN ('web', 'email', 'whatsapp', 'phone')),

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    closed_at DATETIME
);

-- Request attachments
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    size INTEGER,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Request updates/comments
CREATE TABLE IF NOT EXISTS request_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    comment TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER REFERENCES requests(id),
    user_id INTEGER REFERENCES users(id),
    type TEXT CHECK(type IN ('email', 'whatsapp', 'sms')),
    recipient TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
    sent_at DATETIME,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_updates_request ON request_updates(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_request ON notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Insert default categories
INSERT OR IGNORE INTO categories (id, name, name_he, description, icon, sort_order) VALUES
(1, 'infrastructure', 'תשתיות', 'כבישים, תאורה, ביוב, מים', '🛠️', 1),
(2, 'environment', 'סביבה ונוף', 'ניקיון, גינון, מפגעים סביבתיים', '🌳', 2),
(3, 'security', 'בטחון ובטיחות', 'גדרות, מצלמות, סיורים', '🔒', 3),
(4, 'community', 'קהילה ורווחה', 'אירועים, מתנ"ס, נוער', '👥', 4),
(5, 'admin', 'מינהל', 'תשלומים, מסמכים, אישורים', '📋', 5),
(6, 'emergency', 'חירום', 'דיווחים דחופים', '🚨', 6);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
('site_name', 'יישוב מיצד', 'שם האתר'),
('admin_email', 'admin@meitzad.org.il', 'אימייל מנהל'),
('whatsapp_notifications', 'true', 'האם לשלוח התראות WhatsApp'),
('email_notifications', 'true', 'האם לשלוח התראות אימייל'),
('auto_assign', 'false', 'הקצאה אוטומטית של פניות');
