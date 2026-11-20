const { createServer } = require('node:https');
const { readFileSync } = require('node:fs');

createServer({
  key: readFileSync('/tls/https-fixture.key'),
  cert: readFileSync('/tls/https-fixture.crt'),
}, (req, res) => {
  req.resume();
  const status = req.method === 'POST' ? 201 : 200;
  res.writeHead(req.socket.servername === 'https-fixture' ? status : 400).end();
}).listen(8443);
