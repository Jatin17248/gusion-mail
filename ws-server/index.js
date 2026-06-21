// @ts-nocheck
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
require('dotenv').config();

const port = process.env.PORT || 8080;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// HTTP server handles health checks; WebSocket server upgrades from it
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server: httpServer });

httpServer.listen(port, () => {
  console.log(`WebSocket server running on port ${port}`);
});

const redisSubscriber = new Redis(redisUrl);

redisSubscriber.on('connect', () => {
  console.log('Connected to Redis Subscriber');
});

redisSubscriber.on('error', (err) => {
  console.error('Redis error:', err);
});

// Subscribe to channels. "app_events" will be our generic channel
redisSubscriber.subscribe('app_events', (err, count) => {
  if (err) {
    console.error('Failed to subscribe:', err);
    return;
  }
  console.log(`Subscribed to ${count} channels.`);
});

redisSubscriber.on('message', (channel, message) => {
  console.log(`Received message from ${channel}: ${message}`);
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Simple ping-pong heartbeat
  ws.on('message', (data) => {
    if (data.toString() === 'ping') {
      ws.send('pong');
    }
  });
});

// Cron scheduling for background tasks (Fly.io worker role)
const cron = require('node-cron');

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET;

if (cronSecret) {
  console.log(`Cron scheduler active. Target app URL: ${appUrl}`);
  
  // Every 5 minutes: trigger process jobs
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running process jobs cron...');
    try {
      const res = await fetch(`${appUrl}/api/jobs/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      console.log(`Process jobs response status: ${res.status}`);
    } catch (err) {
      console.error('Error triggering process jobs:', err);
    }
  });

  // Daily at 12:00 PM: trigger lifecycle cron
  cron.schedule('0 12 * * *', async () => {
    console.log('Running lifecycle cron...');
    try {
      const res = await fetch(`${appUrl}/api/cron/lifecycle`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      console.log(`Lifecycle cron response status: ${res.status}`);
    } catch (err) {
      console.error('Error triggering lifecycle cron:', err);
    }
  });
} else {
  console.warn('CRON_SECRET not set. Cron scheduler is disabled.');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    redisSubscriber.quit();
    process.exit(0);
  });
});
