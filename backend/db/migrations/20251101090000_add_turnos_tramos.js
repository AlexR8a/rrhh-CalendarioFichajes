exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable('TurnosTramos');
  if (!hasTable) {
    await knex.schema.createTable('TurnosTramos', (table) => {
      table.increments('id_tramo').primary();
      table.integer('id_turno').notNullable();
      table.integer('orden').unsigned().notNullable().defaultTo(1);
      table.time('hora_inicio').notNullable();
      table.time('hora_fin').notNullable();
      table.foreign('id_turno').references('id_turno').inTable('Turnos').onDelete('CASCADE');
      table.unique(['id_turno', 'orden']);
      table.index(['id_turno']);
    });
  }

  // Copiar los turnos existentes al nuevo esquema (un tramo por turno)
  const turnos = await knex('Turnos').select('id_turno', 'hora_inicio', 'hora_fin');
  if (turnos && turnos.length) {
    const inserts = turnos
      .filter((t) => t.hora_inicio && t.hora_fin)
      .map((t) => ({
        id_turno: t.id_turno,
        orden: 1,
        hora_inicio: t.hora_inicio,
        hora_fin: t.hora_fin,
      }));
    if (inserts.length) {
      // Evita duplicados si ya se insertaron antes
      for (const chunk of chunkArray(inserts, 200)) {
        const values = chunk.map(() => '(?, ?, ?, ?)').join(',');
        const bindings = [];
        chunk.forEach((item) => {
          bindings.push(item.id_turno, item.orden, item.hora_inicio, item.hora_fin);
        });
        await knex.raw(
          `INSERT IGNORE INTO TurnosTramos (id_turno, orden, hora_inicio, hora_fin) VALUES ${values}`,
          bindings
        );
      }
    }
  }
};

exports.down = async function down(knex) {
  const hasTable = await knex.schema.hasTable('TurnosTramos');
  if (hasTable) {
    await knex.schema.dropTable('TurnosTramos');
  }
};

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}



