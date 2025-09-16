/**
 * Crea tablas para la planificación anual basada en códigos de turno:
 * - TurnosCodigo: catálogo de códigos de turno con horas asociadas
 * - PlanificacionAsignaciones: una asignación (código) por trabajador y día
 */

exports.up = async function up(knex) {
  // TurnosCodigo
  const hasCodes = await knex.schema.hasTable('TurnosCodigo');
  if (!hasCodes) {
    await knex.schema.createTable('TurnosCodigo', (t) => {
      t.increments('id_turno_codigo').primary();
      t.string('codigo', 16).notNullable().unique();
      t.string('descripcion', 255).defaultTo('');
      t.decimal('horas', 5, 2).notNullable().defaultTo(0);
      t.boolean('activo').notNullable().defaultTo(true);
      t.timestamp('creado_en').defaultTo(knex.fn.now());
      t.timestamp('actualizado_en').defaultTo(knex.fn.now());
    });
  }

  // PlanificacionAsignaciones
  const hasPlan = await knex.schema.hasTable('PlanificacionAsignaciones');
  if (!hasPlan) {
    await knex.schema.createTable('PlanificacionAsignaciones', (t) => {
      t.increments('id_asignacion').primary();
      t.integer('id_trabajador').notNullable();
      t.date('fecha').notNullable();
      t.integer('id_turno_codigo').unsigned().nullable();
      t.unique(['id_trabajador', 'fecha'], 'uniq_trabajador_fecha');
      t.index(['fecha'], 'idx_planificacion_fecha');
    });
    // Añadir claves foráneas en alterTable protegido
    try {
      await knex.schema.alterTable('PlanificacionAsignaciones', (t) => {
        t
          .foreign('id_trabajador', 'fk_plan_trabajador')
          .references('id_trabajador')
          .inTable('Trabajadores')
          .onDelete('CASCADE');
        t
          .foreign('id_turno_codigo', 'fk_plan_turno_codigo')
          .references('id_turno_codigo')
          .inTable('TurnosCodigo')
          .onDelete('SET NULL');
      });
    } catch (_) {
      // Ignorar si el motor o el estado actual no permiten crear la FK
    }
  }
};

exports.down = async function down(knex) {
  const hasPlan = await knex.schema.hasTable('PlanificacionAsignaciones');
  if (hasPlan) {
    try {
      await knex.schema.alterTable('PlanificacionAsignaciones', (t) => {
        try { t.dropForeign('id_trabajador', 'fk_plan_trabajador'); } catch (_) {}
        try { t.dropForeign('id_turno_codigo', 'fk_plan_turno_codigo'); } catch (_) {}
      });
    } catch (_) {}
    await knex.schema.dropTable('PlanificacionAsignaciones');
  }

  const hasCodes = await knex.schema.hasTable('TurnosCodigo');
  if (hasCodes) {
    await knex.schema.dropTable('TurnosCodigo');
  }
};

