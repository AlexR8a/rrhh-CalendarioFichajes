const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { syncTurnoCodigo } = require('../lib/sync_turno_codigo');

async function getTiendaIdByTurno(knex, id_turno) {
  const row = await knex('Turnos').where({ id_turno }).first();
  return row ? row.id_tienda : null;
}

async function isJefeDeTienda(knex, uid, id_tienda) {
  if (!uid || !id_tienda) return false;
  const t = await knex('Tiendas').where({ id_tienda, id_jefe: uid }).first();
  return !!t;
}

function normalizeHHMM(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toMinutes(value) {
  const normalized = normalizeHHMM(value);
  if (!normalized) return NaN;
  const [hh, mm] = normalized.split(':').map(Number);
  return hh * 60 + mm;
}

function isHalfHour(minutes) {
  return Number.isFinite(minutes) && minutes % 30 === 0;
}

function parseTramosArray(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = [];
  for (let i = 0; i < raw.length; i += 1) {
    const tramo = raw[i];
    if (!tramo) continue;
    const startRaw = tramo.hora_inicio ?? tramo.horaInicio ?? tramo.start ?? tramo.inicio;
    const endRaw = tramo.hora_fin ?? tramo.horaFin ?? tramo.end ?? tramo.fin;
    const start = normalizeHHMM(startRaw);
    const end = normalizeHHMM(endRaw);
    if (!start || !end) {
      throw new Error(`Tramo ${i + 1}: Debes indicar la hora de inicio y fin en formato HH:MM.`);
    }
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    if (!isHalfHour(startMin) || !isHalfHour(endMin)) {
      throw new Error(`Tramo ${i + 1}: Las horas deben estar en intervalos de 30 minutos.`);
    }
    if (endMin <= startMin) {
      throw new Error(`Tramo ${i + 1}: La hora de fin debe ser posterior a la de inicio.`);
    }
    cleaned.push({ start, end, startMin, endMin });
  }
  if (!cleaned.length) {
    return { tramos: [], totalMinutes: 0, inicio: null, fin: null };
  }
  cleaned.sort((a, b) => a.startMin - b.startMin);
  for (let i = 1; i < cleaned.length; i += 1) {
    if (cleaned[i].startMin < cleaned[i - 1].endMin) {
      throw new Error(`Tramo ${i + 1}: No puede solaparse con el tramo anterior.`);
    }
  }
  const tramos = cleaned.map((seg, idx) => ({
    orden: idx + 1,
    hora_inicio: seg.start,
    hora_fin: seg.end,
  }));
  const totalMinutes = cleaned.reduce((acc, seg) => acc + (seg.endMin - seg.startMin), 0);
  return {
    tramos,
    totalMinutes,
    inicio: cleaned[0].start,
    fin: cleaned[cleaned.length - 1].end,
  };
}

function mapTramosByTurno(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row.id_turno;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    const orden = Number(row.orden) || map.get(id).length + 1;
    const inicio = normalizeHHMM(row.hora_inicio);
    const fin = normalizeHHMM(row.hora_fin);
    if (!inicio || !fin) continue;
    map.get(id).push({ orden, hora_inicio: inicio, hora_fin: fin });
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orden - b.orden);
  }
  return map;
}

// Obtener turnos de una tienda
router.get('/tienda/:id_tienda', async (req, res) => {
  try {
    const { id_tienda } = req.params;
    console.log('[turnos] GET /tienda/:id_tienda', id_tienda);
    const turnos = await db('Turnos').where('id_tienda', id_tienda);
    console.log('[turnos] -> turnos encontrados:', turnos?.length);
    const ids = turnos.map((t) => t.id_turno).filter(Boolean);
    let tramosRows = [];
    if (ids.length) {
      tramosRows = await db('TurnosTramos')
        .whereIn('id_turno', ids)
        .orderBy('id_turno', 'asc')
        .orderBy('orden', 'asc');
    }
    const tramosMap = mapTramosByTurno(tramosRows);
    const enriched = turnos.map((turno) => {
      const lista = tramosMap.get(turno.id_turno) || [];
      return {
        ...turno,
        tramos: lista,
        es_partido: lista.length > 1,
      };
    });
    res.json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
});

// Obtener trabajadores de una tienda
router.get('/trabajadores/:id_tienda', async (req, res) => {
  try {
    const { id_tienda } = req.params;
    console.log('[turnos] GET /trabajadores/:id_tienda', id_tienda);
    const trabajadores = await db('Trabajadores')
      .join('Usuarios', 'Trabajadores.id_trabajador', 'Usuarios.id_usuario')
      .where('Trabajadores.id_tienda', id_tienda)
      .select('Trabajadores.id_trabajador', 'Usuarios.nombre');
    console.log('[turnos] -> trabajadores:', trabajadores?.length);
    res.json(trabajadores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener trabajadores' });
  }
});

// (Eliminados) Endpoints de asignación de turnos

// Obtener requerimientos para una semana y tienda
router.get('/requerimientos', async (req, res) => {
  try {
    const { id_tienda, semana_inicio } = req.query;
    console.log('[turnos] GET /requerimientos', { id_tienda, semana_inicio });
    const fechaInicio = new Date(`${semana_inicio}T00:00:00`);
    const fechas = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      fechas.push(d.toISOString().slice(0, 10));
    }

    const turnos = await db('Turnos').where('id_tienda', id_tienda);

    const requerimientos = await db('RequerimientosTurno')
      .whereIn('fecha', fechas)
      .whereIn('id_turno', turnos.map((t) => t.id_turno))
      .select();

    console.log('[turnos] -> requerimientos:', requerimientos?.length, 'fechas:', fechas?.length);
    res.json({ requerimientos, fechas, turnos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener requerimientos' });
  }
});

// Crear o actualizar un requerimiento
router.post('/requerimientos', authenticate, async (req, res) => {
  try {
    let { id_turno, fecha, cantidad } = req.body;
    cantidad = Number(cantidad);
    console.log('[turnos] POST /requerimientos payload:', { id_turno, fecha, cantidad });
    if (!id_turno || !fecha || Number.isNaN(cantidad)) {
      return res.status(400).json({ error: 'Faltan campos: id_turno, fecha y cantidad' });
    }
    if (cantidad < 1) {
      return res.status(400).json({ error: 'La cantidad requerida debe ser al menos 1' });
    }
    const id_tienda = await getTiendaIdByTurno(db, id_turno);
    const allowed = await isJefeDeTienda(db, req.user?.uid, id_tienda);
    if (!allowed) return res.status(403).json({ error: 'No autorizado' });

    const existe = await db('RequerimientosTurno').where({ id_turno, fecha }).first();

    if (existe) {
      await db('RequerimientosTurno').where({ id_turno, fecha }).update({ cantidad });
    } else {
      await db('RequerimientosTurno').insert({ id_turno, fecha, cantidad });
    }

    console.log('[turnos] -> requerimiento guardado OK');
    res.json({ mensaje: 'Requerimiento guardado' });
  } catch (error) {
    console.error('[turnos] requerimientos error:', error);
    res.status(500).json({ error: 'Error al guardar requerimiento' });
  }
});

function ensureAdmin(req) {
  const rol = req.user?.rol?.toLowerCase();
  return rol === 'admin' || rol === 'administrador';
}

router.post('/', authenticate, async (req, res) => {
  try {
    let { id_tienda, id_tipo_turno, hora_inicio, hora_fin, codigo, descripcion, tramos } = req.body || {};

    const tiendaId = parseInt(id_tienda, 10);
    if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
      return res.status(400).json({ error: 'id_tienda es obligatorio' });
    }

    const isAdmin = ensureAdmin(req);
    let allowed = isAdmin;

    if (!allowed) {
      allowed = await isJefeDeTienda(db, req.user?.uid, tiendaId);
    }
    if (!allowed) return res.status(403).json({ error: 'No autorizado' });

    codigo = String(codigo || '').trim().toUpperCase();
    if (!codigo) {
      return res.status(400).json({ error: 'El codigo es obligatorio' });
    }
    if (codigo.length > 8 || !/^[A-Z0-9]+$/.test(codigo)) {
      return res.status(400).json({ error: 'El codigo debe ser alfanumerico (sin espacios) y hasta 8 caracteres' });
    }

    descripcion = String(descripcion || '').trim();
    if (descripcion.length > 255) {
      return res.status(400).json({ error: 'La descripcion no puede superar 255 caracteres' });
    }

    let tramosPayload = Array.isArray(tramos) ? tramos : null;
    if (!tramosPayload || !tramosPayload.length) {
      if (!hora_inicio || !hora_fin) {
        return res.status(400).json({ error: 'Debes indicar la hora de inicio y fin del turno o los tramos.' });
      }
      tramosPayload = [{ hora_inicio, hora_fin }];
    }

    let parsed;
    try {
      parsed = parseTramosArray(tramosPayload);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Tramos invalidos' });
    }
    if (!parsed || !parsed.tramos.length) {
      return res.status(400).json({ error: 'Debes indicar al menos un tramo valido.' });
    }

    const totalMinutes = parsed.totalMinutes;
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      return res.status(400).json({ error: 'La suma de tramos debe ser mayor a 0.' });
    }
    if (totalMinutes > 480) {
      return res.status(400).json({ error: 'La duracion maxima de un turno es de 8 horas (suma de tramos).' });
    }

    const existing = await db('Turnos')
      .where({ id_tienda: tiendaId, codigo })
      .first();
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un turno con ese codigo en la tienda' });
    }

    const data = {
      id_tienda: tiendaId,
      id_tipo_turno: id_tipo_turno ? Number(id_tipo_turno) || null : null,
      hora_inicio: parsed.inicio,
      hora_fin: parsed.fin,
      codigo,
      descripcion,
    };

    let id_turno;

    await db.transaction(async (trx) => {
      const inserted = await trx('Turnos').insert(data);
      id_turno = inserted && inserted[0];
      if (id_turno && typeof id_turno === 'object') {
        id_turno = id_turno.id_turno || id_turno.id;
      }
      if (!id_turno) {
        const row = await trx('Turnos')
          .where({ id_tienda: tiendaId, codigo })
          .orderBy('id_turno', 'desc')
          .first();
        id_turno = row?.id_turno;
      }
      if (!id_turno) {
        throw new Error('No se pudo obtener el ID del turno creado.');
      }

      await trx('TurnosTramos').where({ id_turno }).del();
      const tramosRows = parsed.tramos.map((tramo, idx) => ({
        id_turno,
        orden: tramo.orden || idx + 1,
        hora_inicio: tramo.hora_inicio,
        hora_fin: tramo.hora_fin,
      }));
      if (tramosRows.length) {
        await trx('TurnosTramos').insert(tramosRows);
      }
    });

    await syncTurnoCodigo(db, {
      codigo,
      descripcion,
      durationMinutes: totalMinutes,
      tramos: parsed.tramos,
      id_turno,
    });

    res.json({
      mensaje: 'Turno creado correctamente',
      id_turno,
      codigo,
      descripcion,
      hora_inicio: parsed.inicio,
      hora_fin: parsed.fin,
      tramos: parsed.tramos,
    });
  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ error: 'Error interno al crear turno' });
  }
});

module.exports = router;
