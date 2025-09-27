/**
 * Alinea la tabla PlanificacionAsignaciones con las restricciones esperadas
 * para el calendario anual: claves foraneas consistentes y fechas como DATE.
 */

const TABLE = 'PlanificacionAsignaciones';

async function dropForeign(knex, constraint) {
  try {
    await knex.raw(`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${constraint}\``);
  } catch (err) {
    if (!err) return;
    const code = err.errno || err.code;
    if (code === 1091) return; // no existe la FK
    const msg = String(err.message || '');
    if (msg.includes('DROP FOREIGN KEY') && msg.includes('doesn\'t exist')) return;
    throw err;
  }
}

exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) return;

  await dropForeign(knex, 'planificacionasignaciones_id_turno_codigo_foreign');
  await dropForeign(knex, 'fk_plan_trabajador');
  await dropForeign(knex, 'fk_plan_turno_codigo');

  try {
    await knex.raw(`ALTER TABLE \`${TABLE}\` MODIFY \`fecha\` DATE NOT NULL`);
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.includes('CHECK constraint') && !msg.includes('doesn\'t support')) {
      throw err;
    }
  }

  await knex.schema.alterTable(TABLE, (table) => {
    table
      .foreign('id_trabajador', 'fk_plan_trabajador')
      .references('id_trabajador')
      .inTable('Trabajadores')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');
    table
      .foreign('id_turno_codigo', 'fk_plan_turno_codigo')
      .references('id_turno_codigo')
      .inTable('TurnosCodigo')
      .onDelete('SET NULL')
      .onUpdate('CASCADE');
  });
};

exports.down = async function down(knex) {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) return;

  await dropForeign(knex, 'fk_plan_trabajador');
  await dropForeign(knex, 'fk_plan_turno_codigo');

  await knex.schema.alterTable(TABLE, (table) => {
    table
      .foreign('id_turno_codigo', 'planificacionasignaciones_id_turno_codigo_foreign')
      .references('id_turno_codigo')
      .inTable('TurnosCodigo');
  });
};

