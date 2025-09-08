/**
 * Crea tablas RequerimientosTurno y AsignacionesTurno,
 * agrega Tiendas.id_jefe y asegura Turnos.hora_inicio/hora_fin como TIME.
 */

exports.up = async function up(knex) {
  // RequerimientosTurno
  const hasReq = await knex.schema.hasTable('RequerimientosTurno');
  if (!hasReq) {
    await knex.schema.createTable('RequerimientosTurno', (table) => {
      table.increments('id_requerimiento').primary();
      table.integer('id_turno').notNullable();
      table.date('fecha').notNullable();
      table.integer('cantidad').notNullable().defaultTo(0);
      table.unique(['id_turno', 'fecha'], 'uniq_turno_fecha');
    });
    // FK en paso separado por compatibilidad
    try {
      await knex.schema.alterTable('RequerimientosTurno', (table) => {
        table
          .foreign('id_turno', 'fk_req_turno')
          .references('id_turno')
          .inTable('Turnos')
          .onDelete('CASCADE');
      });
    } catch (_) { /* ignora si ya existe */ }
  }

  // AsignacionesTurno
  const hasAsig = await knex.schema.hasTable('AsignacionesTurno');
  if (!hasAsig) {
    await knex.schema.createTable('AsignacionesTurno', (table) => {
      table.increments('id_asignacion').primary();
      table.integer('id_trabajador').notNullable();
      table.integer('id_turno').notNullable();
      table.date('fecha').notNullable();
      table.integer('asignado_por').nullable();
      table.dateTime('fecha_asignacion').notNullable().defaultTo(knex.fn.now());
      table.unique(['id_trabajador', 'id_turno', 'fecha'], 'uniq_trab_turno_fecha');
      table.index(['id_turno', 'fecha'], 'idx_turno_fecha');
    });
    try {
      await knex.schema.alterTable('AsignacionesTurno', (table) => {
        table
          .foreign('id_trabajador', 'fk_asig_trab')
          .references('id_trabajador')
          .inTable('Trabajadores')
          .onDelete('CASCADE');
        table
          .foreign('id_turno', 'fk_asig_turno')
          .references('id_turno')
          .inTable('Turnos')
          .onDelete('CASCADE');
        table
          .foreign('asignado_por', 'fk_asig_usuario')
          .references('id_usuario')
          .inTable('Usuarios');
      });
    } catch (_) { /* ignora si ya existe */ }
  }

  // Agregar id_jefe a Tiendas (si no existe)
  const hasJefe = await knex.schema.hasColumn('Tiendas', 'id_jefe');
  if (!hasJefe) {
    await knex.schema.alterTable('Tiendas', (table) => {
      table.integer('id_jefe').nullable();
    });
    try {
      await knex.schema.alterTable('Tiendas', (table) => {
        table
          .foreign('id_jefe', 'fk_tiendas_jefe')
          .references('id_usuario')
          .inTable('Usuarios');
      });
    } catch (_) { /* ignora si ya existe */ }
  }

  // Asegurar TIME en Turnos.hora_inicio/hora_fin
  try {
    await knex.raw('ALTER TABLE `Turnos` MODIFY `hora_inicio` TIME NOT NULL');
  } catch (_) { /* puede estar ya en TIME */ }
  try {
    await knex.raw('ALTER TABLE `Turnos` MODIFY `hora_fin` TIME NOT NULL');
  } catch (_) { /* puede estar ya en TIME */ }
};

exports.down = async function down(knex) {
  // Quitar id_jefe si existe
  const hasJefe = await knex.schema.hasColumn('Tiendas', 'id_jefe');
  if (hasJefe) {
    try {
      await knex.schema.alterTable('Tiendas', (table) => {
        table.dropForeign('id_jefe', 'fk_tiendas_jefe');
      });
    } catch (_) { /* puede no existir FK */ }
    await knex.schema.alterTable('Tiendas', (table) => {
      table.dropColumn('id_jefe');
    });
  }

  // Borrar AsignacionesTurno
  const hasAsig = await knex.schema.hasTable('AsignacionesTurno');
  if (hasAsig) {
    await knex.schema.dropTable('AsignacionesTurno');
  }

  // Borrar RequerimientosTurno
  const hasReq = await knex.schema.hasTable('RequerimientosTurno');
  if (hasReq) {
    await knex.schema.dropTable('RequerimientosTurno');
  }
};

