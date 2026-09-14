import { createServer } from 'http';
import { Server } from 'socket.io';

// ========== Socket.io Server (port 3004) - for client connections ==========
const wsServer = createServer();

const io = new Server(wsServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`[Realtime] Client connected: ${socket.id} (Total: ${connectedClients})`);

  io.emit('online-count', { count: connectedClients });

  socket.on('disconnect', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[Realtime] Client disconnected: ${socket.id} (Total: ${connectedClients})`);
    io.emit('online-count', { count: connectedClients });
  });

  socket.on('error', (error) => {
    console.error(`[Realtime] Socket error (${socket.id}):`, error);
  });
});

// ========== HTTP Notification Server (port 3005) - for Next.js API routes ==========
const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/notify') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { event, payload } = data;

        console.log(`[Realtime] Broadcasting: ${event}`);

        // Broadcast to ALL connected Socket.io clients
        if (event.startsWith('apartment-')) {
          io.emit('apartments-changed', { event, payload, timestamp: new Date().toISOString() });
        } else if (event === 'message-sent') {
          io.emit('messages-changed', { event, payload, timestamp: new Date().toISOString() });
        } else {
          io.emit('notification', { event, payload, timestamp: new Date().toISOString() });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clients: connectedClients }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: connectedClients }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start both servers
const WS_PORT = 3004;
const HTTP_PORT = 3005;

wsServer.listen(WS_PORT, () => {
  console.log(`[Realtime] Socket.io server running on port ${WS_PORT}`);
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[Realtime] HTTP notification server running on port ${HTTP_PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('[Realtime] Shutting down...');
  wsServer.close(() => {
    httpServer.close(() => process.exit(0));
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
