const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

// Registrar entrada o salida
router.post('/', async (req, res) => {
  const { id_trabajador, tipo } = req.body;
  const fechaHoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const horaAhora = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

  try {
    // Ver si ya hay un fichaje hoy
    const [fichajeHoy] = await db('Fichajes')
      .where({ id_trabajador, fecha: fechaHoy });

    if (!fichajeHoy) {
      if (tipo === 'entrada') {
        await db('Fichajes').insert({
          id_trabajador,
          fecha: fechaHoy,
          hora_entrada: horaAhora,
          fuente: 'fichaje',
        });
        return res.status(201).json({ mensaje: 'Entrada registrada' });
      } else {
        return res.status(400).json({ error: 'Primero debes registrar la entrada' });
      }
    } else {
      if (tipo === 'salida') {
        if (fichajeHoy.hora_salida) {
          return res.status(400).json({ error: 'La salida ya fue registrada' });
        }

        await db('Fichajes')
          .where({ id_fichaje: fichajeHoy.id_fichaje })
          .update({ hora_salida: horaAhora });

        return res.status(200).json({ mensaje: 'Salida registrada' });
      } else {
        return res.status(400).json({ error: 'Ya fichaste entrada hoy' });
      }
    }

  } catch (error) {
    console.error('Error al fichar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener fichajes por trabajador
router.get('/:id_trabajador', async (req, res) => {
  const { id_trabajador } = req.params;

  try {
    const fichajes = await db('Fichajes')
      .where({ id_trabajador })
      .orderBy('fecha', 'desc');

    res.json(fichajes);
  } catch (error) {
    console.error('Error al obtener fichajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ver fichaje de hoy
router.get('/hoy/:id_trabajador', async (req, res) => {
  const { id_trabajador } = req.params;
  const fechaHoy = new Date().toISOString().split('T')[0];

  try {
    const [fichaje] = await db('Fichajes')
      .where({ id_trabajador, fecha: fechaHoy });

    res.json(fichaje || {});
  } catch (error) {
    console.error('Error al obtener fichaje de hoy:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

// Nuevos endpoints para vista semanal y edición manual

// GET /api/fichajes/semana?tienda=ID&desde=YYYY-MM-DD
router.get('/semana', authenticate, async (req, res) => {
  try {
    const tienda = req.query.tienda && parseInt(req.query.tienda, 10);
    const desde = req.query.desde;
    if (!tienda || !desde) {
      return res.status(400).json({ error: 'Parámetros requeridos: tienda, desde (YYYY-MM-DD)' });
    }
    const start = new Date(desde + 'T00:00:00');
    if (isNaN(start.getTime())) return res.status(400).json({ error: 'Fecha inválida' });
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const hasta = end.toISOString().slice(0,10);

    // Trabajadores de la tienda
    const trabajadores = await db('Trabajadores as T')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .select('T.id_trabajador', 'U.nombre')
      .where('T.id_tienda', tienda)
      .orderBy('U.nombre');

    const ids = trabajadores.map(t => t.id_trabajador);
    let fichajes = [];
    if (ids.length) {
      fichajes = await db('Fichajes')
        .select('id_fichaje', 'id_trabajador', 'fecha', 'hora_entrada', 'hora_salida', 'fuente')
        .whereIn('id_trabajador', ids)
        .andWhere('fecha', '>=', desde)
        .andWhere('fecha', '<=', hasta)
        .orderBy(['id_trabajador', 'fecha']);
    }

    res.json({ trabajadores, fichajes, desde, hasta });
  } catch (err) {
    console.error('Error en GET /fichajes/semana:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/fichajes/manual  { id_trabajador, fecha, hora_entrada, hora_salida }
router.put('/manual', authenticate, async (req, res) => {
  try {
    const role = String(req.user?.rol || '').toLowerCase();
    if (role !== 'jefe' && role !== 'admin' && role !== 'administrador') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { id_trabajador, fecha, hora_entrada, hora_salida } = req.body || {};
    if (!id_trabajador || !fecha) return res.status(400).json({ error: 'id_trabajador y fecha son requeridos' });

    const exists = await db('Fichajes').where({ id_trabajador, fecha }).first();
    if (exists) {
      await db('Fichajes').where({ id_fichaje: exists.id_fichaje }).update({
        hora_entrada: hora_entrada || null,
        hora_salida: hora_salida || null,
        fuente: 'manual'
      });
      return res.json({ mensaje: 'Fichaje actualizado' });
    } else {
      const [id_fichaje] = await db('Fichajes').insert({
        id_trabajador,
        fecha,
        hora_entrada: hora_entrada || null,
        hora_salida: hora_salida || null,
        fuente: 'manual'
      });
      return res.status(201).json({ mensaje: 'Fichaje creado', id_fichaje });
    }
  } catch (err) {
    console.error('Error en PUT /fichajes/manual:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/fichajes/semana.csv?tienda=ID&desde=YYYY-MM-DD
router.get('/semana.csv', authenticate, async (req, res) => {
  try {
    const tienda = req.query.tienda && parseInt(req.query.tienda, 10);
    const desde = req.query.desde;
    if (!tienda || !desde) return res.status(400).json({ error: 'Parámetros requeridos: tienda, desde' });

    const start = new Date(desde + 'T00:00:00');
    if (isNaN(start.getTime())) return res.status(400).json({ error: 'Fecha inválida' });
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const hasta = end.toISOString().slice(0,10);

    const trabajadores = await db('Trabajadores as T')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .select('T.id_trabajador', 'U.nombre')
      .where('T.id_tienda', tienda)
      .orderBy('U.nombre');
    const ids = trabajadores.map(t => t.id_trabajador);
    let fichajes = [];
    if (ids.length) {
      fichajes = await db('Fichajes')
        .select('id_trabajador', 'fecha', 'hora_entrada', 'hora_salida')
        .whereIn('id_trabajador', ids)
        .andWhere('fecha', '>=', desde)
        .andWhere('fecha', '<=', hasta);
    }

    const days = [...Array(7)].map((_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().slice(0,10);
    });
    const header = ['Empleado', ...days.flatMap((d, i) => [`D${i+1} Entrada`, `D${i+1} Salida`]), 'Total (min)'];
    const lines = [header.join(',')];
    for (const t of trabajadores) {
      let total = 0;
      const row = [escapeCSV(t.nombre)];
      for (const d of days) {
        const f = fichajes.find(x => x.id_trabajador === t.id_trabajador && x.fecha === d);
        row.push(f?.hora_entrada || '');
        row.push(f?.hora_salida || '');
        total += diffMinutes(f?.hora_entrada, f?.hora_salida);
      }
      row.push(String(total));
      lines.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fichajes_${tienda}_${desde}.csv"`);
    res.send(lines.join('\n'));

    function toMin(hhmmss) {
      if (!hhmmss) return null;
      const [hh, mm] = String(hhmmss).split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return hh * 60 + mm;
    }
    function diffMinutes(a, b) {
      const am = toMin(a); const bm = toMin(b);
      if (am == null || bm == null) return 0;
      const d = bm - am; return d > 0 ? d : 0;
    }
    function escapeCSV(v) {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
  } catch (err) {
    console.error('Error en GET /fichajes/semana.csv:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
