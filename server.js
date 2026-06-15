/* ================================================================
   SNAKE LEADERBOARD SERVER — Pure Node.js (zero dependencies)
   Stores scores as JSON file. No npm install needed.
   Just run: node server.js
   ================================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3456;
const DATA_FILE = path.join(__dirname, 'snake_scores.json');

// --- Data store ---
function loadScores() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error loading scores:', e.message);
    return [];
  }
}

function saveScores(scores) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving scores:', e.message);
  }
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

    const scores = loadScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
    saveScores(scores);

    const rank = scores.findIndex(s => s.id === entry.id) + 1;
    return jsonRes(res, 200, { id: entry.id, rank, total_players: scores.length });
  }

  // GET /api/leaderboard — get rankings
  if (method === 'GET' && pathname === '/api/leaderboard') {
    const limit = Math.min(Math.max(parseInt(query.limit) || 30, 1), 100);
    const offset = Math.max(parseInt(query.offset) || 0, 0);

    const scores = loadScores();
    const page = scores.slice(offset, offset + limit);
    const ranked = page.map((s, i) => ({ ...s, rank: offset + i + 1 }));

    return jsonRes(res, 200, { leaderboard: ranked, total: scores.length, limit, offset });
  }

  // GET /api/rank/:score — get estimated rank for a score
  const rankMatch = pathname.match(/^\/api\/rank\/(\d+)$/);
  if (method === 'GET' && rankMatch) {
    const targetScore = parseInt(rankMatch[1]);
    const scores = loadScores();
    const rank = scores.filter(s => s.score > targetScore).length + 1;
    return jsonRes(res, 200, { rank, total: scores.length });
  }

  // GET /api/health — health check
  if (method === 'GET' && pathname === '/api/health') {
    const scores = loadScores();
    return jsonRes(res, 200, { status: 'ok', players: scores.length });
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

server.listen(PORT, () => {
  const scores = loadScores();
  console.log('═══════════════════════════════════════════');
  console.log('  🐍 Snake Leaderboard Server');
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/leaderboard`);
  console.log(`  Scores on file: ${scores.length}`);
  console.log('═══════════════════════════════════════════');
});
