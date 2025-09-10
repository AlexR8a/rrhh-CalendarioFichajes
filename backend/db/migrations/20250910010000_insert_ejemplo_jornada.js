/**
 * Inserta un ejemplo de jornada para la tienda 1:
 * - Crea 3 turnos de 4h: 09-13, 13-17, 17-21
 * - Define requerimientos para una fecha concreta
 * - (Opcional) Asigna trabajadores existentes de la tienda 1 si los hay
 */

exports.up = async function up(knex) {
  const TIENDA_ID = 1;
  const FECHA = '2025-09-15'; // ajusta si lo deseas

  async function ensureTurno(hora_inicio, hora_fin) {
    let row = await knex('Turnos').where({ id_tienda: TIENDA_ID, hora_inicio, hora_fin }).first();
    if (!row) {
      const [id_turno] = await knex('Turnos').insert({ id_tienda: TIENDA_ID, id_tipo_turno: null, hora_inicio, hora_fin });
      return id_turno;
    }
    return row.id_turno || row.id || row.ID;
  }

  async function upsertRequerimiento(id_turno, cantidad) {
    const existing = await knex('RequerimientosTurno').where({ id_turno, fecha: FECHA }).first();
    if (existing) {
      await knex('RequerimientosTurno').where({ id_requerimiento: existing.id_requerimiento }).update({ cantidad });
    } else {
      await knex('RequerimientosTurno').insert({ id_turno, fecha: FECHA, cantidad });
    }
  }

  async function ensureAsignacion(id_trabajador, id_turno) {
    const exists = await knex('AsignacionesTurno').where({ id_trabajador, id_turno, fecha: FECHA }).first();
    if (!exists) {
      await knex('AsignacionesTurno').insert({ id_trabajador, id_turno, fecha: FECHA, asignado_por: null });
    }
  }

  // 1) Crear/asegurar turnos de la jornada
  const t_mani = await ensureTurno('09:00', '13:00');
  const t_tard = await ensureTurno('13:00', '17:00');
  const t_cier = await ensureTurno('17:00', '21:00');

  // 2) Requerimientos del día
  await upsertRequerimiento(t_mani, 2);
  await upsertRequerimiento(t_tard, 2);
  await upsertRequerimiento(t_cier, 1);

  // 3) Asignaciones de ejemplo (opcional, si hay trabajadores en la tienda 1)
  const trabajadores = await knex('Trabajadores').where('id_tienda', TIENDA_ID).select('id_trabajador').orderBy('id_trabajador').limit(4);
  const ids = trabajadores.map((t) => t.id_trabajador);
  if (ids.length >= 1) await ensureAsignacion(ids[0], t_mani);
  if (ids.length >= 2) await ensureAsignacion(ids[1], t_mani);
  if (ids.length >= 1) await ensureAsignacion(ids[0], t_tard);
  if (ids.length >= 3) await ensureAsignacion(ids[2], t_tard);
  if (ids.length >= 4) await ensureAsignacion(ids[3], t_cier);
  else if (ids.length >= 1) await ensureAsignacion(ids[0], t_cier);
};

exports.down = async function down(knex) {
  const TIENDA_ID = 1;
  const FECHA = '2025-09-15';

  async function getTurno(hora_inicio, hora_fin) {
    return knex('Turnos').where({ id_tienda: TIENDA_ID, hora_inicio, hora_fin }).first();
  }

  const ma = await getTurno('09:00', '13:00');
  const ta = await getTurno('13:00', '17:00');
  const ci = await getTurno('17:00', '21:00');
  const ids = [ma?.id_turno, ta?.id_turno, ci?.id_turno].filter(Boolean);

  if (ids.length) {
    await knex('AsignacionesTurno').whereIn('id_turno', ids).andWhere({ fecha: FECHA }).del();
    await knex('RequerimientosTurno').whereIn('id_turno', ids).andWhere({ fecha: FECHA }).del();

    // Eliminar turnos sólo si no tienen otras referencias
    const asigsOtras = await knex('AsignacionesTurno').whereIn('id_turno', ids).first();
    const reqsOtras = await knex('RequerimientosTurno').whereIn('id_turno', ids).andWhereNot({ fecha: FECHA }).first();
    if (!asigsOtras && !reqsOtras) {
      await knex('Turnos').whereIn('id_turno', ids).del();
    }
  }
};

