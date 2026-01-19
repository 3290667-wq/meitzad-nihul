const jwt = require('jsonwebtoken');
const { getUserById } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'meitzad-secret-key-change-in-production';

// Verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'לא סופק טוקן אימות' });
  }

  const token = authHeader.split(' ')[1]; // Bearer TOKEN

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'טוקן לא תקין או פג תוקף' });
  }
}

// Check if user has required role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'נדרשת התחברות' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין לך הרשאה לפעולה זו' });
    }

    next();
  };
}

// Middleware combinations
const isAuthenticated = verifyToken;

const isAdmin = [
  verifyToken,
  requireRole('super_admin', 'admin')
];

const isStaff = [
  verifyToken,
  requireRole('super_admin', 'admin', 'staff')
];

const isSuperAdmin = [
  verifyToken,
  requireRole('super_admin')
];

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  verifyToken,
  authenticateToken: verifyToken, // Alias for backward compatibility
  requireRole,
  isAuthenticated,
  isAdmin,
  isStaff,
  isSuperAdmin,
  generateToken,
  JWT_SECRET
};
