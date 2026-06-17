import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import cron from 'node-cron';
import { processJobs, processLifecycle } from './lib/worker-tasks';

const port = Number(process.env.PORT) || 8080;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// 1. WebSocket Server (Broadcasting Redis Events)
const wss = new WebSocketServer({ port });
console.log(`[Worker] WebSocket server running on port ${port}`);

const redisSubscriber = new Redis(redisUrl);

redisSubscriber.on('connect', () => {
  console.log('[Worker] Connected to Redis Subscriber');
});

redisSubscriber.on('error', (err: unknown) => {
  console.error('[Worker] Redis error:', err);
});

// Subscribe to Redis generic app events channel
void redisSubscriber.subscribe('app_events', (err: Error | null | undefined, count?: unknown) => {
  if (err) {
    console.error('[Worker] Failed to subscribe to Redis events:', err);
    return;
  }
  console.log(`[Worker] Subscribed to ${String(count)} Redis channels.`);
});

redisSubscriber.on('message', (channel: string, message: string) => {
  console.log(`[Worker] Received Redis event: ${message}`);
  
  // Broadcast to all connected WS clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('[Worker] WS client connected');
  
  ws.on('close', () => {
    console.log('[Worker] WS client disconnected');
  });

  ws.on('message', (data) => {
    const msg = Buffer.isBuffer(data)
      ? data.toString()
      : Array.isArray(data)
      ? Buffer.concat(data).toString()
      : new TextDecoder().decode(data);
    if (msg === 'ping') {
      ws.send('pong');
    }
  });
});

// 2. In-Process Cron Job Scheduler
console.log('[Worker] In-process database cron scheduler active.');

// Every 5 minutes: run processJobs() in-process
cron.schedule('*/5 * * * *', async () => {
  console.log('[Worker] Running processJobs directly in-process...');
  try {
    const results = await processJobs();
    console.log('[Worker] processJobs finished successfully:', results);
  } catch (err) {
    console.error('[Worker] Error running processJobs:', err);
  }
});

// Daily at 12:00 PM: run processLifecycle() in-process
cron.schedule('0 12 * * *', async () => {
  console.log('[Worker] Running processLifecycle directly in-process...');
  try {
    const results = await processLifecycle();
    console.log('[Worker] processLifecycle finished successfully:', results);
  } catch (err) {
    console.error('[Worker] Error running processLifecycle:', err);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Worker] Shutting down worker...');
  wss.close(() => {
    void redisSubscriber.quit();
    process.exit(0);
  });
});
