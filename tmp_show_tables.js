const db = require('./backend/db/connection');
(async () => {
  try {
    const [rows] = await db.raw('SHOW TABLES');
    console.log(rows);
  } catch (err) {
    console.error('Error', err);
  } finally {
    await db.destroy();
  }
})();
