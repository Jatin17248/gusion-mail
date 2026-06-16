// @ts-nocheck
const WebSocket = require('ws');
const Redis = require('ioredis');
require('dotenv').config();

const port = process.env.PORT || 8080;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const wss = new WebSocket.Server({ port });
console.log(`WebSocket server running on port ${port}`);

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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    redisSubscriber.quit();
    process.exit(0);
  });
});
