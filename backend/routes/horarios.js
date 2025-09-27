const express = require('express');
const router = express.Router();
const db = require('../db/connection');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_START_MINUTES = 9 * 60; // 09:00 por defecto para slots generados

function buildWeek(startISO) {
  if (typeof startISO !== 'string') return null;
  const trimmed = startISO.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    const current = new Date(date.getTime() + i * ONE_DAY_MS);
    dates.push(current.toISOString().slice(0, 10));
  }
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    dates,
  };
}

function toISODate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toHHMM(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2}:\d{2})/);
    if (match) return match[1];
    if (value.length >= 5) return value.slice(0, 5);
    return value;
  }
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  const str = String(value);
  const match = str.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : str;
}

function toMinutes(value) {
  const hhmm = toHHMM(value);
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function diffMinutes(start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff <= 0) diff += 24 * 60; // cubrir turnos que pasan medianoche (no deberia, pero por seguridad)
  return diff;
}

function minutesToHHMM(total) {
  if (!Number.isFinite(total)) return null;
  const clamped = Math.max(0, Math.min(Math.round(total), 23 * 60 + 59));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function defaultSlotForHours(hours) {
  const mins = Math.max(0, Math.round(Number(hours || 0) * 60));
  if (mins <= 0) return null;
  const start = DEFAULT_START_MINUTES;
  const end = Math.min(start + mins, 24 * 60);
  const endMinutes = end >= 24 * 60 ? 23 * 60 + 59 : end;
  return {
    hora_inicio: minutesToHHMM(start),
    hora_fin: minutesToHHMM(endMinutes),
  };
}

function pickTurnoByDuration(durationMinutes, turnosByDuration) {
  if (!turnosByDuration || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }
  const list = turnosByDuration.get(durationMinutes);
  if (!list || !list.length) return null;
  const sorted = list
    .slice()
    .filter((t) => toMinutes(t.hora_inicio) !== null && toMinutes(t.hora_fin) !== null)
    .sort((a, b) => (toMinutes(a.hora_inicio) ?? 0) - (toMinutes(b.hora_inicio) ?? 0));
  const candidates = sorted.length ? sorted : list;
  const chosen = candidates.find((t) => {
    const start = toMinutes(t.hora_inicio);
    return start !== null && start >= DEFAULT_START_MINUTES;
  });
  return chosen || candidates[0] || null;
}

// GET /api/horarios/semana?tienda=ID&inicio=YYYY-MM-DD
router.get('/semana', async (req, res) => {
  const { tienda, inicio } = req.query;
  const tiendaId = Number.parseInt(String(tienda || '').trim(), 10);
  if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
    return res.status(400).json({ error: 'Parametro tienda invalido' });
  }

  const week = buildWeek(inicio);
  if (!week) {
    return res.status(400).json({ error: 'Parametro inicio invalido (use YYYY-MM-DD)' });
  }

  try {
    const empleadosRows = await db('Trabajadores as T')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .where('T.id_tienda', tiendaId)
      .select('T.id_trabajador', 'U.nombre', 'U.email', 'U.rol')
      .orderBy('U.nombre');

    const empleados = empleadosRows.map((row) => ({
      id_trabajador: row.id_trabajador,
      nombre: row.nombre || row.email || `Trabajador ${row.id_trabajador}`,
      email: row.email || null,
      rol: row.rol || null,
    }));
    const empleadoMap = new Map(empleados.map((emp) => [emp.id_trabajador, emp]));

    const turnosRows = await db('Turnos')
      .where('id_tienda', tiendaId)
      .select('id_turno', 'hora_inicio', 'hora_fin');

    const turnosByDuration = new Map();
    for (const row of turnosRows) {
      const start = toHHMM(row.hora_inicio);
      const end = toHHMM(row.hora_fin);
      const duration = diffMinutes(start, end);
      if (!start || !end || !duration) continue;
      const info = {
        id_turno: row.id_turno || null,
        hora_inicio: start,
        hora_fin: end,
      };
      if (!turnosByDuration.has(duration)) turnosByDuration.set(duration, []);
      turnosByDuration.get(duration).push(info);
    }

    const asignacionesRows = await db('AsignacionesTurno as A')
      .join('Turnos as TR', 'TR.id_turno', 'A.id_turno')
      .join('Trabajadores as TB', 'TB.id_trabajador', 'A.id_trabajador')
      .join('Usuarios as U', 'U.id_usuario', 'TB.id_trabajador')
      .where('TR.id_tienda', tiendaId)
      .whereIn('A.fecha', week.dates)
      .select(
        'A.id_asignacion',
        'A.fecha',
        'A.id_trabajador',
        'A.id_turno',
        'TR.hora_inicio',
        'TR.hora_fin',
        'U.nombre as trabajador_nombre'
      )
      .orderBy('A.fecha', 'asc')
      .orderBy('TR.hora_inicio', 'asc')
      .orderBy('U.nombre', 'asc');

    const asignaciones = asignacionesRows
      .map((row) => {
        const fecha = toISODate(row.fecha);
        const horaInicio = toHHMM(row.hora_inicio);
        const horaFin = toHHMM(row.hora_fin);
        if (!fecha || !horaInicio || !horaFin) return null;
        const empleado = empleadoMap.get(row.id_trabajador);
        return {
          id_asignacion: row.id_asignacion || null,
          id_trabajador: row.id_trabajador,
          id_turno: row.id_turno || null,
          nombre: row.trabajador_nombre || empleado?.nombre || empleado?.email || `Trabajador ${row.id_trabajador}`,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          codigo: null,
          origen: 'turno',
        };
      })
      .filter(Boolean);

    const existentes = new Set(asignaciones.map((row) => `${row.id_trabajador}|${row.fecha}`));

    let planRows = [];
    if (empleados.length) {
      const ids = empleados.map((emp) => emp.id_trabajador).filter((id) => id !== null && id !== undefined);
      if (ids.length) {
        planRows = await db('PlanificacionAsignaciones as P')
          .leftJoin('TurnosCodigo as C', 'C.id_turno_codigo', 'P.id_turno_codigo')
          .whereIn('P.id_trabajador', ids)
          .whereBetween('P.fecha', [week.start, week.end])
          .select(
            'P.id_trabajador',
            'P.fecha',
            'P.id_turno_codigo',
            'C.codigo',
            'C.descripcion',
            'C.horas'
          )
          .orderBy('P.fecha', 'asc')
          .orderBy('P.id_trabajador', 'asc');
      }
    }

    const planAsignaciones = [];
    for (const row of planRows) {
      const fecha = toISODate(row.fecha);
      if (!fecha) continue;
      const trabajadorId = row.id_trabajador;
      const key = `${trabajadorId}|${fecha}`;
      if (existentes.has(key)) continue;
      const horas = Number(row.horas || 0);
      if (!row.id_turno_codigo || !Number.isFinite(horas) || horas <= 0) continue;

      const durationMinutes = Math.round(horas * 60);
      const turno = pickTurnoByDuration(durationMinutes, turnosByDuration);
      let horaInicio = turno ? toHHMM(turno.hora_inicio) : null;
      let horaFin = turno ? toHHMM(turno.hora_fin) : null;

      if (!horaInicio || !horaFin) {
        const slot = defaultSlotForHours(horas);
        if (!slot) continue;
        horaInicio = slot.hora_inicio;
        horaFin = slot.hora_fin;
      }

      const empleado = empleadoMap.get(trabajadorId);
      const nombre = empleado?.nombre || empleado?.email || `Trabajador ${trabajadorId}`;

      planAsignaciones.push({
        id_asignacion: null,
        id_trabajador: trabajadorId,
        id_turno: turno?.id_turno || null,
        nombre,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        codigo: row.codigo || null,
        origen: 'planificacion',
      });
      existentes.add(key);
    }

    const combinadas = [...asignaciones, ...planAsignaciones].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      const aStart = toMinutes(a.hora_inicio) ?? 0;
      const bStart = toMinutes(b.hora_inicio) ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });

    return res.json({
      tienda: tiendaId,
      inicio: week.start,
      fin: week.end,
      empleados,
      asignaciones: combinadas,
    });
  } catch (err) {
    console.error('[horarios] semana error', err);
    return res.status(500).json({ error: 'Error al consultar horarios' });
  }
});

module.exports = router;
