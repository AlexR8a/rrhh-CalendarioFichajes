const db = require('./backend/db/connection');
(async () => {
  try {
    const query = process.argv.slice(2).join(' ');
    if (!query) {
      console.error('Provide SQL query as arguments');
      process.exit(1);
      return;
    }
    const [rows] = await db.raw(query);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
})();
