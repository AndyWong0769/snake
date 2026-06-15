/* ================================================================
   SNAKE LEADERBOARD SERVER — Node.js + Upstash Redis (persistent!)
   Zero npm dependencies — uses Upstash REST API via built-in https.
   Just run: node server.js
   ================================================================ */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3456;

// --- Upstash Redis Config ---
const REDIS_URL = process.env.REDIS_URL || 'https://tender-osprey-86140.upstash.io';
const REDIS_TOKEN = process.env.REDIS_TOKEN || 'gQAAAAAAAVB8AAIgcDJlYzQ4OTY1M2QwZTI0ZjBmYmE2M2JlM2I5MDI4ZmQ4YQ';
const LEADERBOARD_KEY = 'snake:leaderboard';

// --- Redis REST API helper ---
function redisCmd(...args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(args);
    const url = new URL(REDIS_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed.result);
        } catch(e) {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Redis timeout')); });
    req.write(body);
    req.end();
  });
}

// Pipeline helper — sends multiple commands in one HTTP request
function redisPipeline(cmds) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(cmds);
    const url = new URL(REDIS_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: '/pipeline',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          resolve(results.map(r => {
            if (r.error) throw new Error(r.error);
            return r.result;
          }));
        } catch(e) {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Redis timeout')); });
    req.write(body);
    req.end();
  });
}

// --- MIME types for static files ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.bat': 'text/plain',
  '.md': 'text/plain',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// --- JSON helpers ---
function jsonRes(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

// --- Server ---
const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams.entries());
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  // --- API Routes ---

  // POST /api/scores — submit score
  if (method === 'POST' && pathname === '/api/scores') {
    const body = await parseBody(req);
    if (!body || body.score == null || body.score < 0) {
      return jsonRes(res, 400, { error: 'Invalid score' });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      player_name: String(body.player_name || 'Anonymous').substring(0, 30),
      ip: getClientIP(req),
      score: Math.floor(body.score),
      length: Math.floor(body.length || 0),
      form: String(body.form || 'Hatchling'),
      difficulty: String(body.difficulty || 'medium'),
      mode: String(body.mode || 'classic'),
      time_seconds: Math.floor(body.time_seconds || 0),
      created_at: new Date().toISOString()
    };

    try {
      const member = JSON.stringify(entry);
      // Pipeline: ZADD + ZREVRANK + ZCARD in one round-trip
      const results = await redisPipeline([
        ['ZADD', LEADERBOARD_KEY, String(entry.score), member],
        ['ZREVRANK', LEADERBOARD_KEY, member],
        ['ZCARD', LEADERBOARD_KEY],
      ]);

      // ZREVRANK is 0-indexed (0 = highest score), so add 1 for 1-indexed rank
      const rank = (typeof results[1] === 'number' ? results[1] : parseInt(results[1])) + 1;
      const total = typeof results[2] === 'number' ? results[2] : parseInt(results[2]);

      return jsonRes(res, 200, { id: entry.id, rank, total_players: total });
    } catch (e) {
      console.error('Redis error (submit score):', e.message);
      return jsonRes(res, 500, { error: 'Failed to save score' });
    }
  }

  // GET /api/leaderboard — get rankings
  if (method === 'GET' && pathname === '/api/leaderboard') {
    const limit = Math.min(Math.max(parseInt(query.limit) || 30, 1), 100);
    const offset = Math.max(parseInt(query.offset) || 0, 0);

    try {
      // Pipeline: ZCARD + ZREVRANGE (WITHSCORES not needed since score is in the member JSON)
      const results = await redisPipeline([
        ['ZCARD', LEADERBOARD_KEY],
        ['ZREVRANGE', LEADERBOARD_KEY, String(offset), String(offset + limit - 1)],
      ]);

      const total = typeof results[0] === 'number' ? results[0] : parseInt(results[0]);
      const members = results[1] || [];

      const leaderboard = members.map((member, i) => {
        const entry = JSON.parse(member);
        return { ...entry, rank: offset + i + 1 };
      });

      return jsonRes(res, 200, { leaderboard, total, limit, offset });
    } catch (e) {
      console.error('Redis error (leaderboard):', e.message);
      return jsonRes(res, 500, { error: 'Failed to fetch leaderboard' });
    }
  }

  // GET /api/rank/:score — get estimated rank for a score
  const rankMatch = pathname.match(/^\/api\/rank\/(\d+)$/);
  if (method === 'GET' && rankMatch) {
    const targetScore = parseInt(rankMatch[1]);

    try {
      // ZCOUNT with exclusive lower bound: count entries with score > targetScore
      const count = await redisCmd('ZCOUNT', LEADERBOARD_KEY, '(' + targetScore, '+inf');
      const c = typeof count === 'number' ? count : parseInt(count);

      const total = await redisCmd('ZCARD', LEADERBOARD_KEY);
      const t = typeof total === 'number' ? total : parseInt(total);

      return jsonRes(res, 200, { rank: c + 1, total: t });
    } catch (e) {
      console.error('Redis error (rank):', e.message);
      return jsonRes(res, 500, { error: 'Failed to estimate rank' });
    }
  }

  // GET /api/health — health check
  if (method === 'GET' && pathname === '/api/health') {
    try {
      const result = await redisCmd('PING');
      const total = await redisCmd('ZCARD', LEADERBOARD_KEY);
      const t = typeof total === 'number' ? total : parseInt(total);
      return jsonRes(res, 200, { status: 'ok', redis: result === 'PONG', players: t });
    } catch (e) {
      return jsonRes(res, 200, { status: 'degraded', redis: false, players: 0 });
    }
  }

  // --- Static file serving ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  // Security: ensure we stay within project directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  serveStatic(res, filePath);
});

server.listen(PORT, async () => {
  console.log('═══════════════════════════════════════════');
  console.log('  🐍 Snake Leaderboard Server');
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/leaderboard`);
  console.log(`  DB:   Upstash Redis (persistent ✅)`);

  // Check Redis connection
  try {
    await redisCmd('PING');
    const total = await redisCmd('ZCARD', LEADERBOARD_KEY);
    const t = typeof total === 'number' ? total : parseInt(total);
    console.log(`  Redis: connected — ${t} scores stored`);
  } catch (e) {
    console.log(`  Redis: ⚠️  connection failed — ${e.message}`);
  }

  console.log('═══════════════════════════════════════════');
});
