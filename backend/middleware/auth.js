const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(input) {
  const pad = input.length % 4 === 2 ? '==' : input.length % 4 === 3 ? '=' : input.length % 4 === 1 ? '===' : '';
  const s = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(s, 'base64').toString('utf8');
}

function sign(payload, expiresInSec = 60 * 60 * 8) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const b = base64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SECRET).update(b).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) throw new Error('Token inválido');
  const [b, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(b).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (sig !== expected) throw new Error('Firma inválida');
  const payload = JSON.parse(fromBase64url(b));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error('Token expirado');
  return payload;
}

function authenticate(req, res, next) {
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    const payload = verify(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { sign, verify, authenticate };
