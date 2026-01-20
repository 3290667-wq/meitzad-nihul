const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

let io = null;

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
      } catch (err) {
        // Token invalid - continue as guest
        socket.user = null;
      }
    } else {
      socket.user = null;
    }

    next();
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`, socket.user ? `(${socket.user.email})` : '(guest)');

    // Admin/Staff subscribe to all requests
    socket.on('subscribe:requests', () => {
      if (socket.user && ['super_admin', 'admin', 'staff'].includes(socket.user.role)) {
        socket.join('requests');
        console.log(`${socket.user.email} subscribed to all requests`);
      }
    });

    // User subscribe to their own requests
    socket.on('subscribe:my-requests', () => {
      if (socket.user) {
        socket.join(`user:${socket.user.id}`);
        console.log(`${socket.user.email} subscribed to their requests`);
      }
    });

    // Subscribe to specific request updates
    socket.on('subscribe:request', (requestId) => {
      socket.join(`request:${requestId}`);
    });

    socket.on('unsubscribe:request', (requestId) => {
      socket.leave(`request:${requestId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  console.log('Socket.io initialized');
  return io;
}

// Notify about new request
function notifyNewRequest(request) {
  if (io) {
    io.to('requests').emit('request:created', request);
  }
}

// Notify about request update
function notifyRequestUpdate(request) {
  if (io) {
    // Notify all admins
    io.to('requests').emit('request:updated', request);

    // Notify request owner
    if (request.user_id) {
      io.to(`user:${request.user_id}`).emit('request:updated', request);
    }

    // Notify specific request subscribers
    io.to(`request:${request.id}`).emit('request:updated', request);
  }
}

// Notify about new comment
function notifyNewComment(requestId, comment) {
  if (io) {
    io.to('requests').emit('request:comment', { requestId, comment });
    io.to(`request:${requestId}`).emit('request:comment', { requestId, comment });
  }
}

// Get Socket.io instance
function getIO() {
  return io;
}

module.exports = {
  initializeSocket,
  notifyNewRequest,
  notifyRequestUpdate,
  notifyNewComment,
  getIO
};
