const https = require('node:https');
const http = require('node:http');

const CATEGORY_SEED_TIMEOUT_MS = 1000;

const seedCategories = async (userId, categories) => {
  const categoriesUrl = process.env.CATEGORIES_SERVICE_URL;
  const body = JSON.stringify({ userId, categories });
  const url = new URL(`${categoriesUrl}/api/categories/seed`);
  const transport = url.protocol === 'https:' ? https : http;

  await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        signal: AbortSignal.timeout(CATEGORY_SEED_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Internal-Key': process.env.INTERNAL_API_KEY || '',
        },
        rejectUnauthorized: true,
      },
      (res) => {
        res.on('error', reject);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`categories seed returned ${res.statusCode}`));
          }
        });
        res.resume();
      }
    );
    req.on('error', reject);
    req.end(body);
  });
};

module.exports = { seedCategories };
