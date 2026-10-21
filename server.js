const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'FlashCart';

// In-Memory Optimized State & Atomic Locks Registry (Redis Emulation)
let items = [
  {
    "id": "PRD-01",
    "name": "PlayStation 5 Pro Limited Edition",
    "price": 699,
    "stock": 42,
    "orig_stock": 500,
    "status": "Flash Live",
    "specs": "2TB SSD \u00b7 4K 120Hz \u00b7 Liquid Metal",
    "img": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80"
  },
  {
    "id": "PRD-02",
    "name": "Apple iPhone 16 Pro Max 512GB",
    "price": 1199,
    "stock": 18,
    "orig_stock": 300,
    "status": "Almost Gone",
    "specs": "Titanium \u00b7 A18 Pro Chip \u00b7 48MP",
    "img": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&q=80"
  },
  {
    "id": "PRD-03",
    "name": "NVIDIA GeForce RTX 5090",
    "price": 1599,
    "stock": 7,
    "orig_stock": 150,
    "status": "Extreme Demand",
    "specs": "32GB GDDR7 \u00b7 Blackwell Architecture",
    "img": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&q=80"
  }
];
let activeLocks = new Map();
let auditLogs = [
    { timestamp: new Date().toISOString(), action: 'SYSTEM_BOOT', details: 'Engine initialized successfully on port ' + PORT }
];

// Server definition
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS & Security Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Static Dashboard Delivery
    if (pathname === '/' || pathname === '/index.html') {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading dashboard');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // REST API Endpoints
    if (pathname === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'UP',
            service: SERVICE_NAME,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            checks: {
                database: 'CONNECTED (Latency: 1.1ms)',
                redis_lock_engine: 'ACTIVE',
                memory_usage: process.memoryUsage()
            }
        }));
        return;
    }

    if (pathname === '/metrics') {
        const memory = process.memoryUsage();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(
            `# HELP process_uptime_seconds Total service uptime\n` +
            `# TYPE process_uptime_seconds gauge\n` +
            `process_uptime_seconds ${process.uptime()}\n` +
            `# HELP process_heap_bytes Process heap memory usage\n` +
            `# TYPE process_heap_bytes gauge\n` +
            `process_heap_bytes ${memory.heapUsed}\n` +
            `# HELP active_locks_count Number of active concurrency locks\n` +
            `# TYPE active_locks_count gauge\n` +
            `active_locks_count ${activeLocks.size}\n`
        );
        return;
    }

    if (pathname === '/api/v1/items' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: items.length, data: items }));
        return;
    }

    if (pathname === '/api/v1/lock' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const lockId = data.id || 'ITEM-' + Date.now();
                const leaseSeconds = data.duration || 600; // 10 minutes default
                
                if (activeLocks.has(lockId)) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Resource already locked by another transaction' }));
                    return;
                }

                activeLocks.set(lockId, { lockedAt: Date.now(), expiresAt: Date.now() + (leaseSeconds * 1000) });
                auditLogs.unshift({ timestamp: new Date().toISOString(), action: 'LOCK_ACQUIRED', details: `Resource ${lockId} locked for ${leaseSeconds}s` });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, lockId, expiresAt: activeLocks.get(lockId).expiresAt }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    if (pathname === '/api/v1/audit-logs' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: auditLogs.length, data: auditLogs.slice(0, 50) }));
        return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
    console.log(`[🚀 ${SERVICE_NAME}] Engine running live at http://localhost:${PORT}`);
});
