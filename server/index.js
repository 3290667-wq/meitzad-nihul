// Load environment variables from .env file (if exists)
const dotenvPath = require('path').join(__dirname, '../config/.env');
require('dotenv').config({ path: dotenvPath });
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

// Import database and services
const { initializeDatabase } = require('./database/db');
const { initializeSocket } = require('./services/realtime');
const { startBackupScheduler } = require('./services/backup');

// Import routes
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');
const communityRoutes = require('./routes/community');
const dashboardRoutes = require('./routes/dashboard');
const inquiriesRoutes = require('./routes/inquiries');
const budgetRoutes = require('./routes/budget');
const employeesRoutes = require('./routes/employees');
const meetingsRoutes = require('./routes/meetings');
const projectsRoutes = require('./routes/projects');
const settingsRoutes = require('./routes/settings');
const categoriesRoutes = require('./routes/categories');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoriesRoutes);

// Community management routes
app.use('/api', communityRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

try {
  // Initialize database
  initializeDatabase();
  console.log('✓ Database initialized');

  // Start backup scheduler
  startBackupScheduler();
  console.log('✓ Backup scheduler started');

  // Start server
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   מערכת ניהול יישוב מיצד                    ║
║   Meitzad Community Management System       ║
╠════════════════════════════════════════════╣
║   Server running on port ${PORT}              ║
║   http://localhost:${PORT}                    ║
╚════════════════════════════════════════════╝
    `);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
