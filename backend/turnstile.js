const https = require('https');
const { URLSearchParams } = require('url');

/**
 * Проверка токена Cloudflare Turnstile (секрет хранится только на сервере).
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
function verifyTurnstile(secret, token, remoteip) {
  return new Promise((resolve) => {
    if (!secret || !token || typeof token !== 'string') {
      resolve(false);
      return;
    }
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token.trim());
    if (remoteip) body.set('remoteip', remoteip);
    const payload = body.toString();

    const req = https.request(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(json.success === true);
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

module.exports = { verifyTurnstile };
