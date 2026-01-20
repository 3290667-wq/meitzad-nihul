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

-- =====================================================
-- COMMUNITY MANAGEMENT MODULES - שדרוג לניהול יישוב כללי
-- =====================================================

-- Events table - לוח אירועים קהילתי
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'general' CHECK(event_type IN ('general', 'community', 'kids', 'sports', 'culture', 'holiday', 'meeting', 'emergency')),
    location TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    all_day INTEGER DEFAULT 0,
    recurring TEXT CHECK(recurring IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
    recurring_end_date DATETIME,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    registration_required INTEGER DEFAULT 0,
    registration_deadline DATETIME,
    cost REAL DEFAULT 0,
    image_url TEXT,
    status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'cancelled', 'completed')),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event registrations - הרשמות לאירועים
CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    guest_name TEXT,
    guest_phone TEXT,
    guest_email TEXT,
    num_guests INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('pending', 'confirmed', 'cancelled', 'attended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Announcements - הודעות והכרזות
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK(type IN ('info', 'important', 'urgent', 'warning', 'celebration')),
    priority INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    publish_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire_date DATETIME,
    target_audience TEXT DEFAULT 'all' CHECK(target_audience IN ('all', 'residents', 'committee', 'parents', 'youth', 'elderly')),
    attachment_url TEXT,
    views_count INTEGER DEFAULT 0,
    send_notification INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Announcement reads - מעקב קריאת הודעות
CREATE TABLE IF NOT EXISTS announcement_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Facilities/Resources - מתקנים ומשאבים להזמנה
CREATE TABLE IF NOT EXISTS facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    facility_type TEXT CHECK(facility_type IN ('hall', 'room', 'sports', 'playground', 'equipment', 'vehicle', 'other')),
    location TEXT,
    capacity INTEGER,
    hourly_rate REAL DEFAULT 0,
    daily_rate REAL DEFAULT 0,
    requires_approval INTEGER DEFAULT 0,
    min_booking_hours INTEGER DEFAULT 1,
    max_booking_hours INTEGER DEFAULT 24,
    available_days TEXT DEFAULT '0,1,2,3,4,5,6',
    available_start_time TEXT DEFAULT '07:00',
    available_end_time TEXT DEFAULT '22:00',
    image_url TEXT,
    rules TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Facility bookings - הזמנות מתקנים
CREATE TABLE IF NOT EXISTS facility_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    booking_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    purpose TEXT,
    num_participants INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
    total_cost REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'refunded')),
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Community directory - ספר טלפונים קהילתי
CREATE TABLE IF NOT EXISTS directory_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    display_name TEXT NOT NULL,
    family_name TEXT,
    address TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    secondary_phone TEXT,
    occupation TEXT,
    skills TEXT,
    bio TEXT,
    profile_image TEXT,
    is_public INTEGER DEFAULT 1,
    show_phone INTEGER DEFAULT 1,
    show_email INTEGER DEFAULT 1,
    show_address INTEGER DEFAULT 1,
    category TEXT DEFAULT 'resident' CHECK(category IN ('resident', 'business', 'service', 'committee', 'emergency')),
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents - מסמכים ונהלים
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('protocols', 'forms', 'regulations', 'financial', 'general', 'emergency')),
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    version TEXT DEFAULT '1.0',
    is_public INTEGER DEFAULT 1,
    requires_acknowledgment INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Document acknowledgments - אישורי קריאת מסמכים
CREATE TABLE IF NOT EXISTS document_acknowledgments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, user_id)
);

-- Polls/Surveys - סקרים והצבעות
CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT DEFAULT 'poll' CHECK(poll_type IN ('poll', 'survey', 'vote')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed', 'archived')),
    start_date DATETIME,
    end_date DATETIME,
    is_anonymous INTEGER DEFAULT 0,
    multiple_choice INTEGER DEFAULT 0,
    show_results INTEGER DEFAULT 1,
    min_selections INTEGER DEFAULT 1,
    max_selections INTEGER,
    target_audience TEXT DEFAULT 'all',
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Poll options - אפשרויות בסקר
CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Poll votes - הצבעות
CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Committee members - חברי וועד
CREATE TABLE IF NOT EXISTS committee_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    role TEXT NOT NULL,
    title TEXT,
    responsibilities TEXT,
    contact_hours TEXT,
    is_active INTEGER DEFAULT 1,
    start_date DATE,
    end_date DATE,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Financial records - רשומות כספיות (תשלומי וועד)
CREATE TABLE IF NOT EXISTS financial_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    record_type TEXT CHECK(record_type IN ('charge', 'payment', 'credit', 'refund')),
    amount REAL NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('committee_fee', 'water', 'electricity', 'event', 'facility', 'fine', 'other')),
    due_date DATE,
    paid_date DATE,
    payment_method TEXT,
    reference_number TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance tasks - משימות תחזוקה
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT CHECK(task_type IN ('routine', 'repair', 'improvement', 'emergency')),
    location TEXT,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to TEXT,
    estimated_cost REAL,
    actual_cost REAL,
    due_date DATE,
    completed_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contacts - אנשי קשר לחירום
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    secondary_phone TEXT,
    available_hours TEXT,
    category TEXT CHECK(category IN ('security', 'medical', 'infrastructure', 'committee', 'external')),
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Quick links - קישורים מהירים
CREATE TABLE IF NOT EXISTS quick_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    category TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON announcements(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_date ON facility_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_facility ON facility_bookings(facility_id);
CREATE INDEX IF NOT EXISTS idx_directory_category ON directory_entries(category);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_user ON financial_records(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_status ON financial_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);

-- Insert default event types
INSERT OR IGNORE INTO settings (key, value, description) VALUES
('event_types', 'general,community,kids,sports,culture,holiday,meeting,emergency', 'סוגי אירועים זמינים');

-- Insert default facilities
INSERT OR IGNORE INTO facilities (id, name, description, facility_type, capacity, requires_approval) VALUES
(1, 'אולם הקהילה', 'אולם מרכזי לאירועים ופעילויות', 'hall', 150, 1),
(2, 'חדר ישיבות', 'חדר ישיבות לפגישות וועד', 'room', 20, 0),
(3, 'מגרש כדורגל', 'מגרש ספורט מרכזי', 'sports', 30, 0),
(4, 'גינת המשחקים', 'גינה ציבורית עם מתקני משחק', 'playground', 50, 0);

-- Insert default emergency contacts
INSERT OR IGNORE INTO emergency_contacts (id, name, role, phone, category, sort_order) VALUES
(1, 'קב"ט היישוב', 'אחראי ביטחון', '050-0000000', 'security', 1),
(2, 'מוקד חירום', 'מוקד 24/7', '100', 'external', 2),
(3, 'מד"א', 'שירותי רפואה', '101', 'medical', 3),
(4, 'כיבוי אש', 'שירותי כיבוי', '102', 'external', 4),
(5, 'משטרה', 'משטרת ישראל', '100', 'external', 5);

-- Insert default document categories
INSERT OR IGNORE INTO settings (key, value, description) VALUES
('document_categories', 'protocols,forms,regulations,financial,general,emergency', 'קטגוריות מסמכים');

-- Insert quick links defaults
INSERT OR IGNORE INTO quick_links (id, title, url, icon, category, sort_order) VALUES
(1, 'אתר המועצה', 'https://council.gov.il', '🏛️', 'external', 1),
(2, 'דואר ישראל', 'https://israelpost.co.il', '📮', 'services', 2),
(3, 'חברת חשמל', 'https://iec.co.il', '⚡', 'services', 3);

-- =====================================================
-- ADDITIONAL TABLES FOR FULL MANAGEMENT SYSTEM
-- =====================================================

-- Employees table - עובדים
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_number TEXT UNIQUE,
    name TEXT NOT NULL,
    position TEXT,
    department TEXT CHECK(department IN ('management', 'maintenance', 'security', 'education', 'admin', 'other')),
    phone TEXT,
    email TEXT,
    address TEXT,
    start_date DATE,
    end_date DATE,
    employment_type TEXT DEFAULT 'full_time' CHECK(employment_type IN ('full_time', 'part_time', 'contract', 'volunteer')),
    salary REAL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave', 'deleted')),
    photo TEXT,
    send_attendance_notifications INTEGER DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance records - נוכחות
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in DATETIME,
    check_out DATETIME,
    total_hours REAL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Transactions table - תנועות כספיות
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category TEXT CHECK(category IN ('infrastructure', 'maintenance', 'security', 'education', 'welfare', 'employees', 'taxes', 'other')),
    date DATE NOT NULL,
    notes TEXT,
    receipt_number TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Meetings table - ישיבות
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'regular' CHECK(type IN ('regular', 'emergency', 'annual', 'special')),
    date DATETIME NOT NULL,
    location TEXT,
    agenda TEXT,
    participants TEXT,
    has_protocol INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Protocols table - פרוטוקולים
CREATE TABLE IF NOT EXISTS protocols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    meeting_date DATE,
    meeting_type TEXT,
    participants TEXT,
    content TEXT,
    audio_file TEXT,
    status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'approved')),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table - פרויקטים
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('growth', 'infrastructure', 'community', 'environment', 'education', 'security', 'other')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'idea' CHECK(status IN ('idea', 'planning', 'approved', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    budget REAL DEFAULT 0,
    spent REAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    owner TEXT,
    milestones TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inquiries/Requests table (alias for requests with additional fields)
CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_number TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    subject TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('infrastructure', 'security', 'environment', 'education', 'welfare', 'other')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'in-progress', 'pending', 'resolved', 'closed')),
    assigned_to INTEGER REFERENCES users(id),
    source TEXT DEFAULT 'web' CHECK(source IN ('web', 'email', 'whatsapp', 'phone')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- Inquiry updates - עדכוני פניות
CREATE TABLE IF NOT EXISTS inquiry_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE CASCADE,
    status TEXT,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add reset_token columns to users table (for password reset)
-- Using ALTER TABLE IF NOT EXISTS pattern for SQLite compatibility
CREATE TABLE IF NOT EXISTS _temp_check_reset_token (val INTEGER);
DROP TABLE IF EXISTS _temp_check_reset_token;

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_category ON inquiries(category);

-- =====================================================
-- METZAD PHONE DIRECTORY - ספר טלפונים מיצד
-- =====================================================

-- Clear existing directory entries
DELETE FROM directory_entries;

-- Insert phone directory entries
INSERT OR IGNORE INTO directory_entries (display_name, phone, mobile, email, occupation, category, bio, sort_order, is_public) VALUES
-- הנהלה וועד
('מזכירות הישוב', '02-9938395', NULL, NULL, 'מזכירות', 'committee', 'פקס: 02-9938394', 1, 1),
('הרב ישראל גולדשטיין', '02-9934330', '050-9934330', NULL, 'מרא דאתרא', 'committee', NULL, 2, 1),
('מנחם שבתאי', NULL, '053-4440650', NULL, 'מזכיר הישוב', 'committee', NULL, 3, 1),
('אסתר טנץ', NULL, '050-4124805', NULL, 'רכזת קהילה', 'committee', NULL, 4, 1),

-- נוער
('שמואל קוויטני', NULL, '052-7117675', NULL, 'רכז נוער בוגרים', 'service', NULL, 10, 1),
('אלחנן ניר', NULL, '052-7683927', NULL, 'רכז נוער צעירים', 'service', NULL, 11, 1),
('חיה בן נון', NULL, '052-7602925', NULL, 'רכזת נוער צעירות', 'service', NULL, 12, 1),
('אסתר טנץ', NULL, '050-4124805', NULL, 'רכזת נוער בוגרות', 'service', NULL, 13, 1),

-- מקוואות
('מקווה נשים', '02-9938861', '052-7703380', NULL, 'מקווה', 'service', 'כניסה מהרחבה ליד גינת הקראוונים', 20, 1),
('מקווה גברים', NULL, '053-3166135', NULL, 'מקווה', 'service', NULL, 21, 1),

-- חינוך
('מעון בשבילי החינוך', '02-9309569', NULL, NULL, 'מעון', 'service', NULL, 30, 1),
('גן בנות חבר - גן שירה', '02-9934182', NULL, NULL, 'גן ילדים', 'service', NULL, 31, 1),
('גן בנות שקמה - גן מימי', '02-9933215', NULL, NULL, 'גן ילדים', 'service', NULL, 32, 1),
('ת"ת דובר שלום - גן בנים', '02-9933215', NULL, NULL, 'גן ילדים', 'service', NULL, 33, 1),
('ת"ת דובר שלום - ר'' אליהו קוק', '02-5434767', '058-3206451', NULL, 'תלמוד תורה', 'service', NULL, 34, 1),
('ישיבת נחלת יאיר', '02-5702699', '050-4124585', NULL, 'ישיבה', 'service', NULL, 35, 1),
('ישיבה ר'' רפאל קוק', NULL, NULL, NULL, 'ישיבה', 'service', NULL, 36, 1),

-- שירותים קהילתיים
('ספריה', '02-9922397', NULL, NULL, 'ספריה', 'service', NULL, 40, 1),
('חדר פעילות / בנות נוער', '02-9938969', NULL, NULL, 'מתקן קהילתי', 'service', NULL, 41, 1),
('מכולת', '02-6247117', NULL, NULL, 'מכולת', 'business', 'שעות פתיחה: 8:00-10:00, 16:00-20:00', 42, 1),

-- רפואה
('מרפאה כללית מיצד', NULL, '053-3171000', NULL, 'מרפאה', 'service', NULL, 50, 1),
('מרכז חירום רפואי אפרת', '02-9932211', NULL, NULL, 'מרכז חירום', 'emergency', 'א-ה: 19:00-23:00, שבת: 9:00-23:00', 51, 1),
('ציונה גולדשטיין', NULL, '053-2224763', NULL, 'רפואה', 'service', NULL, 52, 1),
('נחמיה כובאני', NULL, '050-6755464', NULL, 'רפואה', 'service', NULL, 53, 1),
('משה יעקובס', NULL, '052-7679736', NULL, 'רפואה', 'service', NULL, 54, 1),
('אבישי משמור', NULL, '054-5754600', NULL, 'רפואה', 'service', NULL, 55, 1),
('מרדכי איטח', NULL, '058-7624595', NULL, 'רפואה', 'service', NULL, 56, 1),

-- ביטחון וחירום
('יהודה המברסטון', NULL, '052-6260404', NULL, 'רבש"צ - קו ביטחון', 'emergency', NULL, 60, 1),
('אלי רוזנברג', NULL, '052-5833181', NULL, 'יו"ר צח"י', 'emergency', NULL, 61, 1),
('שעיה סהר - יד שרה', NULL, '058-3212212', NULL, 'יד שרה', 'service', 'מיקום: ברחבה ליד האולם', 62, 1),
('חמ"ל צבאי', '02-9309497', NULL, NULL, 'חמ"ל', 'emergency', NULL, 63, 1),
('מוקד הגוש', '1208', NULL, NULL, 'מוקד חירום', 'emergency', NULL, 64, 1),

-- תקשורת קהילתית
('קבוצת מייל - מיצד הנהלה', NULL, NULL, 'metzad-hanhala@googlegroups.com', 'רשימת תפוצה', 'service', 'להצטרפות: פנו למזכיר 053-4440650', 70, 1),
('קבוצת מייל - מיצד חברה', NULL, NULL, 'metzad-chevra@googlegroups.com', 'רשימת תפוצה', 'service', 'להצטרפות: פנו למזכיר 053-4440650', 71, 1),
('קו הודעות קהילה', '03-5501187', NULL, NULL, 'קו הודעות', 'service', 'להצטרפות: פנו לאסתר טנץ 050-4124805', 72, 1),
('קו טרמפים', NULL, '079-9335004', NULL, 'קו טרמפים', 'service', NULL, 73, 1),

-- גופים חיצוניים
('מועצה אזורית גוש-עציון', '02-9939933', NULL, NULL, 'מועצה אזורית', 'service', 'מוקד: 106', 80, 1),
('החברה לפיתוח גוש-עציון', '02-9931387', NULL, NULL, 'חברה לפיתוח', 'service', 'נוסף: 02-9931388', 81, 1),
('תחבורה אלקטרה אפיקים', '*3133', NULL, NULL, 'תחבורה ציבורית', 'service', NULL, 82, 1);

-- Update emergency contacts with real data
DELETE FROM emergency_contacts;
INSERT INTO emergency_contacts (id, name, role, phone, category, sort_order) VALUES
(1, 'רבש"צ - יהודה המברסטון', 'קו ביטחון', '052-6260404', 'security', 1),
(2, 'חמ"ל צבאי', 'חמ"ל', '02-9309497', 'security', 2),
(3, 'מוקד הגוש', 'מוקד חירום', '1208', 'external', 3),
(4, 'מרכז חירום רפואי אפרת', 'חירום רפואי', '02-9932211', 'medical', 4),
(5, 'מד"א', 'אמבולנס', '101', 'medical', 5),
(6, 'משטרה', 'משטרת ישראל', '100', 'external', 6),
(7, 'כיבוי אש', 'שירותי כיבוי', '102', 'external', 7),
(8, 'יו"ר צח"י - אלי רוזנברג', 'צח"י', '052-5833181', 'security', 8);
