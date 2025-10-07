const db = require('./connection');
const { syncTurnoCodigo, calcDurationFromTramos } = require('../lib/sync_turno_codigo');

async function main() {
  try {
    const hasCatalog = await db.schema.hasTable('TurnosCodigo');
    if (!hasCatalog) {
      console.error('La tabla TurnosCodigo no existe. Ejecuta las migraciones primero.');
      process.exitCode = 1;
      return;
    }

    const turnos = await db('Turnos').select();
    const stats = {
      total: turnos.length,
      sinCodigo: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const turno of turnos) {
      const codigo = String(turno.codigo || '').trim();
      if (!codigo) {
        stats.sinCodigo += 1;
        continue;
      }

      const tramos = await db('TurnosTramos').where({ id_turno: turno.id_turno }).orderBy('orden', 'asc');
      const duration = calcDurationFromTramos(tramos);

      const res = await syncTurnoCodigo(db, {
        codigo,
        descripcion: turno.descripcion || '',
        durationMinutes: duration,
        tramos,
        id_turno: turno.id_turno,
      });

      if (res.created) stats.created += 1;
      if (res.updated) stats.updated += 1;
      if (res.skipped) stats.skipped += 1;
    }

    console.log('TurnosCodigo sincronizados', stats);
  } catch (err) {
    console.error('Error al sincronizar TurnosCodigo', err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
