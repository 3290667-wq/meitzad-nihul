const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const {
  createRequest,
  getRequestById,
  getRequestByNumber,
  getRequestsByUser,
  getRequestsByStatus,
  getAllRequests,
  updateRequestStatus,
  assignRequest,
  addRequestUpdate,
  getRequestUpdates,
  getCategories,
  getRequestStats,
  getRequestStatsByCategory,
  getRecentRequests,
  getAverageResolutionTime,
  generateRequestNumber,
  addAuditLog
} = require('../database/db');

const { isAuthenticated, isStaff } = require('../middleware/auth');
const { sendNewRequestNotification } = require('../services/notification-service');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../data/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך'));
    }
  }
});

// GET /api/requests/categories - Get all categories
router.get('/categories', (req, res) => {
  try {
    const categories = getCategories.all();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הקטגוריות' });
  }
});

// GET /api/requests/stats - Get request statistics (admin only)
router.get('/stats', isStaff, (req, res) => {
  try {
    const statusStats = getRequestStats.all();
    const categoryStats = getRequestStatsByCategory.all();
    const avgResolution = getAverageResolutionTime.get();

    res.json({
      byStatus: statusStats,
      byCategory: categoryStats,
      avgResolutionHours: avgResolution?.avg_hours || null
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסטטיסטיקות' });
  }
});

// GET /api/requests/recent - Get recent requests (admin only)
router.get('/recent', isStaff, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const requests = getRecentRequests.all(limit);
    res.json(requests);
  } catch (error) {
    console.error('Get recent requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפניות' });
  }
});

// POST /api/requests - Create new request (public)
router.post('/', upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      name, email, phone, address, preferredContact,
      categoryId, subject, description, location, priority
    } = req.body;

    // Validation
    if (!name || !email || !subject || !categoryId) {
      return res.status(400).json({
        error: 'נא למלא את כל השדות הנדרשים (שם, אימייל, נושא, קטגוריה)'
      });
    }

    // Generate request number
    const requestNumber = generateRequestNumber();

    // Get user_id if authenticated
    const userId = req.user?.id || null;

    // Create request
    const result = createRequest.run({
      request_number: requestNumber,
      user_id: userId,
      submitter_name: name,
      submitter_email: email,
      submitter_phone: phone || null,
      submitter_address: address || null,
      preferred_contact: preferredContact || 'email',
      category_id: parseInt(categoryId),
      subject,
      description: description || null,
      location: location || null,
      priority: priority || 'normal',
      source: 'web'
    });

    // Get created request
    const request = getRequestById.get(result.lastInsertRowid);

    // Add initial update
    addRequestUpdate.run({
      request_id: request.id,
      user_id: userId,
      action: 'CREATED',
      comment: 'פנייה נוצרה',
      is_public: 1
    });

    // Log audit
    addAuditLog.run({
      user_id: userId,
      action: 'REQUEST_CREATED',
      entity_type: 'request',
      entity_id: request.id,
      old_values: null,
      new_values: JSON.stringify({ request_number: requestNumber, subject }),
      ip_address: req.ip
    });

    // Send notifications (async)
    sendNewRequestNotification(request).catch(err => {
      console.error('Failed to send notification:', err);
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('requests').emit('request:created', request);
    }

    res.status(201).json({
      message: 'הפנייה נשלחה בהצלחה',
      request: {
        id: request.id,
        requestNumber: request.request_number,
        status: request.status
      }
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת הפנייה' });
  }
});

// GET /api/requests - Get all requests (admin) or user's requests
router.get('/', isAuthenticated, (req, res) => {
  try {
    let requests;

    if (['super_admin', 'admin', 'staff'].includes(req.user.role)) {
      // Admin/Staff - get all or filtered
      const status = req.query.status;
      if (status) {
        requests = getRequestsByStatus.all(status);
      } else {
        requests = getAllRequests.all();
      }
    } else {
      // Citizen - get only their requests
      requests = getRequestsByUser.all(req.user.id, req.user.email);
    }

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפניות' });
  }
});

// GET /api/requests/track/:requestNumber - Track request by number (public)
router.get('/track/:requestNumber', (req, res) => {
  try {
    const request = getRequestByNumber.get(req.params.requestNumber);

    if (!request) {
      return res.status(404).json({ error: 'פנייה לא נמצאה' });
    }

    // Return limited info for public tracking
    res.json({
      requestNumber: request.request_number,
      subject: request.subject,
      category: request.category_name,
      status: request.status,
      priority: request.priority,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
      resolvedAt: request.resolved_at
    });
  } catch (error) {
    console.error('Track request error:', error);
    res.status(500).json({ error: 'שגיאה במעקב הפנייה' });
  }
});

// GET /api/requests/:id - Get single request
router.get('/:id', isAuthenticated, (req, res) => {
  try {
    const request = getRequestById.get(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'פנייה לא נמצאה' });
    }

    // Check permission
    const isOwner = request.user_id === req.user.id ||
                    request.submitter_email === req.user.email;
    const isAdmin = ['super_admin', 'admin', 'staff'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'אין הרשאה לצפות בפנייה זו' });
    }

    // Get updates
    const updates = getRequestUpdates.all(request.id);

    res.json({ ...request, updates });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הפנייה' });
  }
});

// PATCH /api/requests/:id/status - Update request status (staff only)
router.patch('/:id/status', isStaff, (req, res) => {
  try {
    const { status, comment } = req.body;
    const validStatuses = ['new', 'in_progress', 'pending', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'סטטוס לא תקין' });
    }

    const request = getRequestById.get(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'פנייה לא נמצאה' });
    }

    const oldStatus = request.status;

    // Update status
    updateRequestStatus.run({ id: request.id, status });

    // Add update record
    addRequestUpdate.run({
      request_id: request.id,
      user_id: req.user.id,
      action: 'STATUS_CHANGED',
      comment: comment || `סטטוס שונה מ-${oldStatus} ל-${status}`,
      is_public: 1
    });

    // Log audit
    addAuditLog.run({
      user_id: req.user.id,
      action: 'REQUEST_STATUS_UPDATED',
      entity_type: 'request',
      entity_id: request.id,
      old_values: JSON.stringify({ status: oldStatus }),
      new_values: JSON.stringify({ status }),
      ip_address: req.ip
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const updatedRequest = getRequestById.get(request.id);
      io.to('requests').emit('request:updated', updatedRequest);
      io.to(`user:${request.user_id}`).emit('request:updated', updatedRequest);
    }

    res.json({ message: 'הסטטוס עודכן בהצלחה' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הסטטוס' });
  }
});

// PATCH /api/requests/:id/assign - Assign request (staff only)
router.patch('/:id/assign', isStaff, (req, res) => {
  try {
    const { assignedTo } = req.body;

    const request = getRequestById.get(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'פנייה לא נמצאה' });
    }

    // Assign request
    assignRequest.run({ id: request.id, assigned_to: assignedTo || null });

    // Add update record
    addRequestUpdate.run({
      request_id: request.id,
      user_id: req.user.id,
      action: 'ASSIGNED',
      comment: assignedTo ? `הפנייה הוקצתה לטיפול` : 'הוסרה הקצאה',
      is_public: 0
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const updatedRequest = getRequestById.get(request.id);
      io.to('requests').emit('request:updated', updatedRequest);
    }

    res.json({ message: 'הפנייה הוקצתה בהצלחה' });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ error: 'שגיאה בהקצאת הפנייה' });
  }
});

// POST /api/requests/:id/comment - Add comment to request
router.post('/:id/comment', isAuthenticated, (req, res) => {
  try {
    const { comment, isPublic } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'נא להזין תוכן הערה' });
    }

    const request = getRequestById.get(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'פנייה לא נמצאה' });
    }

    // Check permission
    const isOwner = request.user_id === req.user.id;
    const isAdmin = ['super_admin', 'admin', 'staff'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'אין הרשאה להוסיף הערה' });
    }

    // Add comment
    addRequestUpdate.run({
      request_id: request.id,
      user_id: req.user.id,
      action: 'COMMENT',
      comment,
      is_public: isPublic ? 1 : 0
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const updates = getRequestUpdates.all(request.id);
      io.to('requests').emit('request:comment', {
        requestId: request.id,
        updates
      });
    }

    res.json({ message: 'ההערה נוספה בהצלחה' });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת הערה' });
  }
});

module.exports = router;
