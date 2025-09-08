const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db/connection');
const { sign, verify } = require('../middleware/auth');

function passwordMatches(user, password) {
  if (!user) return false;
  for (const [key, val] of Object.entries(user)) {
    if (typeof val !== 'string') continue;
    if (!/pass|contra/i.test(key)) continue; // campos tipo password/contraseña
    // Comparación en claro
    if (val === String(password)) return true;
    // SHA256 hex opcional
    if (val.length === 64 && /^[a-f0-9]+$/i.test(val)) {
      const sha = crypto.createHash('sha256').update(String(password)).digest('hex');
      if (sha === val.toLowerCase()) return true;
    }
  }
  return false;
}

function safeUser(u) {
  const copy = { ...(u || {}) };
  for (const k of Object.keys(copy)) {
    if (/pass|contra/i.test(k)) delete copy[k];
  }
  return copy;
}

router.post('/login', async (req, res) => {
  try {
    const { email, usuario, identifier, identificador, password } = req.body || {};
    const id = identifier || identificador || email || usuario;
    if (!id || typeof password === 'undefined') {
      return res.status(400).json({ error: 'Faltan campos: identificador y password' });
    }

    let user = await db('Usuarios').where('email', id).first();
    if (!user) user = await db('Usuarios').where('nombre', id).first();
    // Primer inicio: sin contraseña almacenada y password vacía
    if (user) {
      let storedPwd = null;
      for (const [k,v] of Object.entries(user)) {
        if (typeof v === 'string' && /pass|contra/i.test(k)) { storedPwd = v; break; }
      }
      if ((!storedPwd || storedPwd.length === 0) && String(password) === '') {
        const uid = user.id_usuario || user.id || user.ID || user.Id;
        const setupToken = sign({ uid, purpose: 'set_password' }, 15*60);
        return res.status(403).json({ requirePassword: true, setupToken, user: safeUser(user) });
      }
    }

    if (!user || !passwordMatches(user, password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const uid = user.id_usuario || user.id || user.ID || user.Id;
    const payload = { uid, email: user.email, rol: user.rol, nombre: user.nombre };
    const token = sign(payload, 60 * 60 * 8); // 8 horas

    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Establecer contraseña en primer inicio de sesión
router.post('/set-password', async (req, res) => {
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    let payload;
    try { payload = verify(token); } catch { return res.status(401).json({ error: 'Token inválido' }); }
    if (!payload || payload.purpose !== 'set_password' || !payload.uid) {
      return res.status(400).json({ error: 'Token no válido para este propósito' });
    }
    const { password, confirm } = req.body || {};
    if (!password || !confirm) return res.status(400).json({ error: 'Password y confirmación son requeridos' });
    if (password !== confirm) return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    const okLen = String(password).length >= 8;
    const okAlpha = /[A-Za-z]/.test(password);
    const okNum = /\d/.test(password);
    if (!(okLen && okAlpha && okNum)) {
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres, incluir letras y números' });
    }
    const sha = crypto.createHash('sha256').update(String(password)).digest('hex');
    let updated = 0;
    try { updated = await db('Usuarios').where({ id_usuario: payload.uid }).update({ 'contrase��a_hash': sha }); } catch (_) {}
    if (!updated) { try { updated = await db('Usuarios').where({ id_usuario: payload.uid }).update({ contrasena_hash: sha }); } catch (_) {} }
    if (!updated) { try { updated = await db('Usuarios').where({ id_usuario: payload.uid }).update({ password: sha }); } catch (_) {} }
    if (!updated) return res.status(500).json({ error: 'No se pudo guardar la contraseña' });
    res.json({ ok: true, mensaje: 'Contraseña establecida' });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: 'Error al establecer contraseña' });
  }
});

module.exports = router;
