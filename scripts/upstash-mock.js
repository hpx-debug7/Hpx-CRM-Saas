const http = require('http');

const state = {
  keys: new Map(),
  ttls: new Map()
};

const server = http.createServer((req, res) => {
  // CORS / headers
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/inspect') {
    return res.end(JSON.stringify({
      keys: Array.from(state.keys.entries()),
      ttls: Array.from(state.ttls.entries()),
      now: Date.now()
    }));
  }

  if (req.url === '/flush') {
    state.keys.clear();
    state.ttls.clear();
    return res.end(JSON.stringify({ result: "OK" }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      if (!body) return res.end(JSON.stringify({ result: null }));
      const payload = JSON.parse(body);
      
      const processCommand = (cmd) => {
        if (!Array.isArray(cmd)) return null;
        const op = String(cmd[0]).toUpperCase();
        const key = cmd[1];

        // Cleanup expired
        if (state.ttls.has(key) && Date.now() > state.ttls.get(key)) {
          state.keys.delete(key);
          state.ttls.delete(key);
        }

        if (op === 'INCR') {
          let val = state.keys.get(key) || 0;
          val++;
          state.keys.set(key, val);
          return val;
        } else if (op === 'EXPIRE') {
          const ttlSeconds = parseInt(cmd[2]);
          state.ttls.set(key, Date.now() + (ttlSeconds * 1000));
          return 1;
        } else {
          return null;
        }
      };

      if (req.url === '/pipeline' && Array.isArray(payload)) {
        const results = payload.map(cmd => ({ result: processCommand(cmd) }));
        return res.end(JSON.stringify(results));
      } else {
        const result = processCommand(payload);
        return res.end(JSON.stringify({ result }));
      }
    } catch (err) {
      console.error(err);
      return res.end(JSON.stringify({ error: String(err) }));
    }
  });
});

server.listen(8080, () => {
  console.log("Mock Upstash REST server started on http://localhost:8080");
});
