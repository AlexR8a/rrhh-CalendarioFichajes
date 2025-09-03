const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener turnos de una tienda
router.get('/tienda/:id_tienda', async (req, res) => {
  try {
    const { id_tienda } = req.params;
    const turnos = await db('Turnos').where('id_tienda', id_tienda);
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

    // Calculamos fechas de la semana (7 días)
    const fechas = [];
    const fechaInicio = new Date(semana_inicio);
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
    const trabajadores = await db('Trabajadores')
      .join('Usuarios', 'Trabajadores.id_trabajador', 'Usuarios.id_usuario')
      .where('Trabajadores.id_tienda', id_tienda)
      .select('Trabajadores.id_trabajador', 'Usuarios.nombre');
    res.json(trabajadores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener trabajadores' });
  }
});

// Asignar trabajador a turno/fecha (requiere requerimiento previo y respeta el cupo)
router.post('/asignar', async (req, res) => {
  try {
    const { id_trabajador, id_turno, fecha, asignado_por } = req.body || {};
    if (!id_trabajador || !id_turno || !fecha) {
      return res
        .status(400)
        .json({ error: 'Faltan campos: id_trabajador, id_turno y fecha son requeridos' });
    }

    await db.transaction(async (trx) => {
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
    const code = error.http || 500;
    res.status(code).json({ error: error.message || 'Error al asignar turno' });
  }
});

// Quitar asignación
router.post('/desasignar', async (req, res) => {
  try {
    const { id_asignacion } = req.body;
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
    const fechaInicio = new Date(semana_inicio);
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

    res.json({ requerimientos, fechas, turnos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener requerimientos' });
  }
});

// Crear o actualizar un requerimiento
router.post('/requerimientos', async (req, res) => {
  try {
    const { id_turno, fecha, cantidad } = req.body;

    // Buscar si ya existe
    const existe = await db('RequerimientosTurno').where({ id_turno, fecha }).first();

    if (existe) {
      await db('RequerimientosTurno').where({ id_turno, fecha }).update({ cantidad });
    } else {
      await db('RequerimientosTurno').insert({ id_turno, fecha, cantidad });
    }

    res.json({ mensaje: 'Requerimiento guardado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar requerimiento' });
  }
});

// Crear turno con validaciones de 15 minutos y 4 horas
router.post('/', async (req, res) => {
  try {
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

