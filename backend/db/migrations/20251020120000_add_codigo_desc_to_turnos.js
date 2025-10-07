exports.up = async function up(knex) {
  const hasCodigo = await knex.schema.hasColumn('Turnos', 'codigo');
  const hasDescripcion = await knex.schema.hasColumn('Turnos', 'descripcion');

  if (!hasCodigo) {
    await knex.schema.alterTable('Turnos', (table) => {
      table.string('codigo', 8).nullable();
    });
  }

  if (!hasDescripcion) {
    await knex.schema.alterTable('Turnos', (table) => {
      table.string('descripcion', 255).notNullable().defaultTo('');
    });
  }

  const hasIndex = await knex.schema.hasColumn('Turnos', 'codigo');
  if (hasIndex) {
    try {
      await knex.schema.alterTable('Turnos', (table) => {
        table.unique(['id_tienda', 'codigo'], 'uniq_turnos_tienda_codigo');
      });
    } catch (err) {
      // ignore if already exists
    }
  }
};

exports.down = async function down(knex) {
  try {
    await knex.schema.alterTable('Turnos', (table) => {
      table.dropUnique(['id_tienda', 'codigo'], 'uniq_turnos_tienda_codigo');
    });
  } catch (err) {
    // may not exist
  }

  const hasDescripcion = await knex.schema.hasColumn('Turnos', 'descripcion');
  if (hasDescripcion) {
    await knex.schema.alterTable('Turnos', (table) => {
      table.dropColumn('descripcion');
    });
  }

  const hasCodigo = await knex.schema.hasColumn('Turnos', 'codigo');
  if (hasCodigo) {
    await knex.schema.alterTable('Turnos', (table) => {
      table.dropColumn('codigo');
    });
  }
};
