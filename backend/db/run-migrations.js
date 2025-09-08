const path = require('path');
const db = require('./connection');

async function main() {
  try {
    const dir = path.join(__dirname, 'migrations');
    console.log('Running migrations from', dir);
    await db.migrate.latest({ directory: dir });
    console.log('Migrations completed');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();

