/**
 * Herramienta de exportación/importación de la base de datos (MySQL) usando Knex.
 *
 * Uso:
 *   - Exportar todas las tablas a JSON:
 *       node backend/db/export_import.js --export ejemplos/rrhh_dump.json
 *
 *   - Importar desde un JSON (truncando antes):
 *       node backend/db/export_import.js --import ejemplos/rrhh_dump.json --truncate
 *
 *   - Limitar tablas específicas (separadas por comas):
 *       node backend/db/export_import.js --export dump.json --tables Usuarios,Tiendas,Turnos
 *       node backend/db/export_import.js --import dump.json --tables Usuarios,Tiendas,Turnos --truncate
 *
 * Recomendado: genera un dump de ejemplo tras insertar datos de prueba:
 *   npm run db:make-sample-dump
 */

const fs = require('fs');
const path = require('path');
const db = require('./connection');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--export') args.export = argv[++i];
    else if (a === '--import') args.import = argv[++i];
    else if (a === '--tables') args.tables = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--truncate') args.truncate = true;
    else args._.push(a);
  }
  return args;
}

async function getDatabaseName() {
  try {
    const row = await db.raw('SELECT DATABASE() AS db');
    const first = row?.[0]?.[0] || row?.[0];
    return first?.db || first?.DATABASE || null;
  } catch {
    return null;
  }
}

async function getBaseTables() {
  // Obtiene tablas base del esquema actual, excluyendo tablas de control de Knex
  const database = await getDatabaseName();
  if (!database) {
    // Fallback: lista explícita conocida en la app
    return [
      'Usuarios', 'Tiendas', 'Trabajadores', 'TiposTurno', 'Turnos',
      'RequerimientosTurno', 'AsignacionesTurno', 'Fichajes', 'Vacaciones'
    ];
  }
  const res = await db.raw(
    "SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.tables WHERE table_schema = ?",
    [database]
  );
  const rows = res?.[0] || res;
  const exclude = new Set(['knex_migrations', 'knex_migrations_lock']);
  return rows
    .filter(r => (r.type || r.TABLE_TYPE) === 'BASE TABLE')
    .map(r => r.name || r.TABLE_NAME)
    .filter(t => !exclude.has(t))
    .sort((a, b) => a.localeCompare(b));
}

async function exportToFile(filePath, tables) {
  const abs = path.resolve(filePath);
  const list = tables && tables.length ? tables : await getBaseTables();
  const database = await getDatabaseName();

  const data = {};
  for (const t of list) {
    try {
      const rows = await db(t).select('*');
      data[t] = rows;
      console.log(`Exportadas ${rows.length} filas de ${t}`);
    } catch (err) {
      console.warn(`Aviso: no se pudo exportar la tabla ${t}:`, err.message || err);
    }
  }

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      database: database || null,
      tables: list
    },
    data
  };
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nExportación completada: ${abs}`);
}

async function truncateTable(table) {
  try {
    await db.raw(`TRUNCATE TABLE \`${table}\``);
  } catch (err) {
    // Fallback si TRUNCATE falla (p.ej. permisos): desactivar FKs temporalmente y hacer DELETE
    try {
      await db.raw('SET FOREIGN_KEY_CHECKS=0');
      await db(table).del();
      await db.raw('SET FOREIGN_KEY_CHECKS=1');
    } catch (e2) {
      throw err; // re-lanza el error original
    }
  }
}

async function importFromFile(filePath, tables, truncate) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`No existe el archivo: ${abs}`);
  const payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const data = payload?.data || {};
  const allTables = Object.keys(data);
  const list = tables && tables.length ? tables.filter(t => allTables.includes(t)) : allTables;

  console.log(`Importando tablas: ${list.join(', ')}`);

  await db.raw('SET FOREIGN_KEY_CHECKS=0');
  try {
    if (truncate) {
      for (const t of list) {
        await truncateTable(t);
        console.log(`Truncada ${t}`);
      }
    }

    for (const t of list) {
      const rows = Array.isArray(data[t]) ? data[t] : [];
      if (!rows.length) continue;
      // Inserción por lotes sencillos
      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        await db(t).insert(slice);
      }
      console.log(`Insertadas ${rows.length} filas en ${t}`);
    }
  } finally {
    await db.raw('SET FOREIGN_KEY_CHECKS=1');
  }

  console.log(`\nImportación completada desde: ${abs}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.export && !args.import) {
    console.log(
      'Uso:\n' +
      '  Exportar: node backend/db/export_import.js --export <archivo.json> [--tables T1,T2]\n' +
      '  Importar: node backend/db/export_import.js --import <archivo.json> [--tables T1,T2] [--truncate]'
    );
    process.exit(0);
  }
  try {
    if (args.export) {
      await exportToFile(args.export, args.tables);
    } else if (args.import) {
      await importFromFile(args.import, args.tables, !!args.truncate);
    }
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();

