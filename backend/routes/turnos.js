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
    for(let i=0; i<7; i++){
      let d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      fechas.push(d.toISOString().slice(0,10));
    }

    // Obtener turnos de la tienda
    const turnos = await db('Turnos').where('id_tienda', id_tienda);

    // Obtener asignaciones en esa semana para esos turnos
    const asignaciones = await db('AsignacionesTurno')
      .join('Trabajadores', 'AsignacionesTurno.id_trabajador', 'Trabajadores.id_trabajador')
      .join('Usuarios', 'Trabajadores.id_trabajador', 'Usuarios.id_usuario')
      .whereIn('AsignacionesTurno.fecha', fechas)
      .whereIn('AsignacionesTurno.id_turno', turnos.map(t => t.id_turno))
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

// Añadir o quitar asignación de turno
router.post('/asignar', async (req, res) => {
  try {
    const { id_trabajador, id_turno, fecha, asignado_por } = req.body;

    // Ver si ya está asignado para evitar duplicados
    const existe = await db('AsignacionesTurno')
      .where({ id_trabajador, id_turno, fecha })
      .first();

    if(existe){
      return res.status(400).json({ error: 'Ya está asignado este trabajador a ese turno y fecha' });
    }

    await db('AsignacionesTurno').insert({
      id_trabajador,
      id_turno,
      fecha,
      asignado_por,
      fecha_asignacion: new Date()
    });

    res.json({ mensaje: 'Asignación creada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al asignar turno' });
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
    for(let i=0; i<7; i++) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      fechas.push(d.toISOString().slice(0,10));
    }

    const turnos = await db('Turnos').where('id_tienda', id_tienda);

    const requerimientos = await db('RequerimientosTurno')
      .whereIn('fecha', fechas)
      .whereIn('id_turno', turnos.map(t => t.id_turno))
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
    const existe = await db('RequerimientosTurno')
      .where({ id_turno, fecha })
      .first();

    if (existe) {
      await db('RequerimientosTurno')
        .where({ id_turno, fecha })
        .update({ cantidad });
    } else {
      await db('RequerimientosTurno').insert({ id_turno, fecha, cantidad });
    }

    res.json({ mensaje: 'Requerimiento guardado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar requerimiento' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id_tienda, id_tipo_turno, hora_inicio, hora_fin } = req.body;

    if (!id_tienda || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const [id_turno] = await db('Turnos').insert({
      id_tienda,
      id_tipo_turno: id_tipo_turno || null,
      hora_inicio,
      hora_fin
    });

    res.json({ mensaje: 'Turno creado correctamente', id_turno });
  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ error: 'Error interno al crear turno' });
  }
});



module.exports = router;
