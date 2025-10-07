const TOLERANCE = 0.01;
let cachedHasTurnosCodigo = null;

async function ensureCatalog(knex) {
  if (cachedHasTurnosCodigo === null) {
    cachedHasTurnosCodigo = await knex.schema.hasTable('TurnosCodigo');
  }
  return cachedHasTurnosCodigo;
}

function toMinutes(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function tramoDuration(tramo) {
  if (!tramo) return 0;
  const start = toMinutes(tramo.hora_inicio);
  const end = toMinutes(tramo.hora_fin);
  if (start === null || end === null) return 0;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

function normalizeDescripcion(value) {
  return String(value || '').trim();
}

function calcDurationFromTramos(tramos) {
  if (!Array.isArray(tramos) || !tramos.length) return 0;
  return tramos.reduce((acc, tramo) => acc + tramoDuration(tramo), 0);
}

async function loadTramos(knex, id_turno) {
  if (!id_turno) return [];
  try {
    const rows = await knex('TurnosTramos').where({ id_turno }).orderBy('orden', 'asc');
    return rows || [];
  } catch (_) {
    return [];
  }
}

function toHoras(durationMinutes) {
  let minutes = Number(durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) minutes = 0;
  return Number((minutes / 60).toFixed(2));
}

async function syncTurnoCodigo(knex, { codigo, descripcion, durationMinutes, tramos, id_turno } = {}) {
  const result = { created: false, updated: false, skipped: false };
  try {
    const code = String(codigo || '').trim();
    if (!code) {
      result.skipped = true;
      return result;
    }

    const hasTable = await ensureCatalog(knex);
    if (!hasTable) {
      result.skipped = true;
      return result;
    }

    let duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      if (!tramos || !tramos.length) {
        tramos = await loadTramos(knex, id_turno);
      }
      duration = calcDurationFromTramos(tramos);
    }

    const horas = toHoras(duration);
    const desc = normalizeDescripcion(descripcion);

    const existing = await knex('TurnosCodigo').where({ codigo: code }).first();
    if (!existing) {
      await knex('TurnosCodigo').insert({ codigo: code, descripcion: desc, horas, activo: 1 });
      result.created = true;
      return result;
    }

    const updates = {};
    const currentHoras = Number(existing.horas || 0);
    if (horas > 0 && Math.abs(currentHoras - horas) >= TOLERANCE) {
      updates.horas = horas;
    }
    if (desc && !existing.descripcion) {
      updates.descripcion = desc;
    }
    if (existing.activo === 0 || existing.activo === false) {
      updates.activo = 1;
    }

    if (Object.keys(updates).length) {
      await knex('TurnosCodigo')
        .where({ id_turno_codigo: existing.id_turno_codigo || existing.id || existing.ID })
        .update(updates);
      result.updated = true;
    }
  } catch (err) {
    console.error('[syncTurnoCodigo] error', err);
    result.skipped = true;
  }
  return result;
}

module.exports = {
  syncTurnoCodigo,
  calcDurationFromTramos,
  tramoDuration,
  toMinutes,
};
