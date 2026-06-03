#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9876;
const WATCH_DIR = __dirname;
const WATCH_EXTENSIONS = ['.js', '.html', '.css', '.json'];

let lastChanged = Date.now();

const watcher = fs.watch(WATCH_DIR, { recursive: false }, (eventType, filename) => {
  if (!filename) return;
  if (filename === 'dev-server.js') return;
  if (WATCH_EXTENSIONS.some(ext => filename.endsWith(ext))) {
    lastChanged = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] Changed: ${filename}`);
  }
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/timestamp') {
    res.end(JSON.stringify({ timestamp: lastChanged }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Codly Dev Server] Watching for changes on port ${PORT}`);
  console.log(`[Codly Dev Server] Directory: ${WATCH_DIR}`);
  console.log(`[Codly Dev Server] Extensions: ${WATCH_EXTENSIONS.join(', ')}`);
  console.log('');
});

process.on('SIGINT', () => {
  watcher.close();
  server.close();
  process.exit(0);
});
