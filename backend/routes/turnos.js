const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

async function getTiendaIdByTurno(knex, id_turno) {
  const row = await knex('Turnos').where({ id_turno }).first();
  return row ? row.id_tienda : null;
}

async function isJefeDeTienda(knex, uid, id_tienda) {
  if (!uid || !id_tienda) return false;
  const t = await knex('Tiendas').where({ id_tienda, id_jefe: uid }).first();
  return !!t;
}

// Obtener turnos de una tienda
router.get('/tienda/:id_tienda', async (req, res) => {
  try {
    const { id_tienda } = req.params;
    console.log('[turnos] GET /tienda/:id_tienda', id_tienda);
    const turnos = await db('Turnos').where('id_tienda', id_tienda);
    console.log('[turnos] -> turnos encontrados:', turnos?.length);
    res.json(turnos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
});

// Obtener asignaciones para semana y tienda
router.get('/asignaciones', async (req, res) => {
  try {
    const { id_tienda, semana_inicio } = req.query; // semana_inicio = YYYY-MM-DD (lunes)
    console.log('[turnos] GET /asignaciones', { id_tienda, semana_inicio });

    // Calculamos fechas de la semana (7 días)
    const fechas = [];
    // Forzar interpretación local evitando desfases por UTC
    const fechaInicio = new Date(`${semana_inicio}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      fechas.push(d.toISOString().slice(0, 10));
    }

    // Obtener turnos de la tienda
    const turnos = await db('Turnos').where('id_tienda', id_tienda);

    // Obtener asignaciones en esa semana para esos turnos
    const asignaciones = await db('AsignacionesTurno')
      .join('Trabajadores', 'AsignacionesTurno.id_trabajador', 'Trabajadores.id_trabajador')
      .join('Usuarios', 'Trabajadores.id_trabajador', 'Usuarios.id_usuario')
      .whereIn('AsignacionesTurno.fecha', fechas)
      .whereIn('AsignacionesTurno.id_turno', turnos.map((t) => t.id_turno))
      .select(
        'AsignacionesTurno.id_asignacion',
        'AsignacionesTurno.id_trabajador',
        'Usuarios.nombre as nombre_trabajador',
        'AsignacionesTurno.id_turno',
        'AsignacionesTurno.fecha'
      );

    console.log('[turnos] -> asignaciones:', asignaciones?.length, 'fechas:', fechas?.length, 'turnos:', turnos?.length);
    res.json({ turnos, asignaciones, fechas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
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

// Asignar trabajador a turno/fecha (requiere requerimiento previo y respeta el cupo)
router.post('/asignar', authenticate, async (req, res) => {
  try {
    const { id_trabajador, id_turno, fecha, asignado_por } = req.body || {};
    if (!id_trabajador || !id_turno || !fecha) {
      return res
        .status(400)
        .json({ error: 'Faltan campos: id_trabajador, id_turno y fecha son requeridos' });
    }

    await db.transaction(async (trx) => {
      const id_tienda = await getTiendaIdByTurno(trx, id_turno);
      const allowed = await isJefeDeTienda(trx, req.user?.uid, id_tienda);
      if (!allowed) {
        const err = new Error('No autorizado');
        err.http = 403;
        throw err;
      }
      // Evitar duplicados
      const existe = await trx('AsignacionesTurno')
        .where({ id_trabajador, id_turno, fecha })
        .first();
      if (existe) {
        const err = new Error('Ya está asignado este trabajador a ese turno y fecha');
        err.http = 400;
        throw err;
      }

      // Debe existir requerimiento > 0
      const reqRow = await trx('RequerimientosTurno').where({ id_turno, fecha }).first();
      if (!reqRow || !reqRow.cantidad || reqRow.cantidad <= 0) {
        const err = new Error(
          'Debes definir primero la cantidad requerida para ese turno y fecha'
        );
        err.http = 400;
        throw err;
      }

      // No superar la cantidad requerida
      const cntRow = await trx('AsignacionesTurno')
        .where({ id_turno, fecha })
        .count({ c: 'id_asignacion' })
        .first();
      const asignados = Number(cntRow?.c ?? 0);
      console.log('[turnos] cupo:', { requeridos: reqRow.cantidad, asignados });
      if (asignados >= reqRow.cantidad) {
        const err = new Error(
          'Ya se alcanzó la cantidad requerida para ese turno y fecha'
        );
        err.http = 400;
        throw err;
      }

      await trx('AsignacionesTurno').insert({
        id_trabajador,
        id_turno,
        fecha,
        asignado_por,
        fecha_asignacion: new Date()
      });
    });

    res.json({ mensaje: 'Asignación creada' });
  } catch (error) {
    console.error('[turnos] asignar error:', error?.message || error);
    const code = error.http || 500;
    res.status(code).json({ error: error.message || 'Error al asignar turno' });
  }
});

// Quitar asignación
router.post('/desasignar', async (req, res) => {
  try {
    const { id_asignacion } = req.body;
    console.log('[turnos] POST /desasignar id_asignacion=', id_asignacion);
    await db('AsignacionesTurno').where('id_asignacion', id_asignacion).del();
    res.json({ mensaje: 'Asignación eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar asignación' });
  }
});

// Obtener requerimientos para una semana y tienda
router.get('/requerimientos', async (req, res) => {
  try {
    const { id_tienda, semana_inicio } = req.query;
    console.log('[turnos] GET /requerimientos', { id_tienda, semana_inicio });
    // Interpretar semana_inicio en horario local para evitar corrimientos
    const fechaInicio = new Date(`${semana_inicio}T00:00:00`);
    const fechas = [];
    for (let i = 0; i < 7; i++) {
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
    // Permiso: debe ser jefe de la tienda del turno
    const id_tienda = await getTiendaIdByTurno(db, id_turno);
    const allowed = await isJefeDeTienda(db, req.user?.uid, id_tienda);
    if (!allowed) return res.status(403).json({ error: 'No autorizado' });

    // Buscar si ya existe
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

// Crear turno con validaciones de 15 minutos y 4 horas
function ensureAdmin(req) {
  const rol = req.user?.rol?.toLowerCase();
  return rol === 'admin' || rol === 'administrador';
}

router.post('/', authenticate, async (req, res) => {
  try {
    if (!ensureAdmin(req)) return res.status(403).json({ error: 'No autorizado' });
    const { id_tienda, id_tipo_turno, hora_inicio, hora_fin } = req.body;

    if (!id_tienda || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Validaciones: intervalos de 15 minutos y duración máxima 4 horas
    const toMinutes = (hhmm) => {
      const [hh, mm] = String(hhmm).split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
      return hh * 60 + mm;
    };

    const startMin = toMinutes(hora_inicio);
    const endMin = toMinutes(hora_fin);

    if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
      return res.status(400).json({ error: 'Formato de hora inválido (use HH:MM)' });
    }

    const isQuarter = (m) => m % 15 === 0;
    if (!isQuarter(startMin) || !isQuarter(endMin)) {
      return res.status(400).json({ error: 'Las horas deben estar en intervalos de 15 minutos' });
    }

    const duration = endMin - startMin;
    if (duration <= 0) {
      return res
        .status(400)
        .json({ error: 'La hora de fin debe ser posterior a la de inicio' });
    }
    if (duration > 240) {
      return res
        .status(400)
        .json({ error: 'La duración máxima de un turno es de 4 horas' });
    }

    const [id_turno] = await db('Turnos').insert({
      id_tienda,
      id_tipo_turno: id_tipo_turno || null,
      hora_inicio,
      hora_fin,
    });

    res.json({ mensaje: 'Turno creado correctamente', id_turno });
  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ error: 'Error interno al crear turno' });
  }
});

module.exports = router;
