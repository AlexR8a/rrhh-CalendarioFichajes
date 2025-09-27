module.exports = {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'rrhh_db',
    dateStrings: true,
    timezone: 'Z'
  },
  pool: {
    afterCreate: (conn, done) => {
      conn.query("SET time_zone = '+00:00';", (err) => done(err, conn));
    }
  },
  migrations: {
    directory: __dirname + '/migrations'
  }
};
