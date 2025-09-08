// Seed de usuarios de prueba: 2 admins, 2 jefes con tiendas, 2 trabajadores
// Ejecuta: node backend/db/seed_test_users.js

const db = require('./connection');

async function upsertUsuario({ nombre, email, password, rol }) {
  // Devuelve { id_usuario }
  const existing = await db('Usuarios').where({ email }).first();
  if (existing) return { id_usuario: existing.id_usuario || existing.id || existing.ID };

  const record = { nombre, email, rol };
  if (typeof password === 'string') {
    // Intentar con la columna existente (puede tener mojibake)
    try { record['contrase��a_hash'] = password; } catch (_) {}
    if (!('contrase��a_hash' in record)) record['contrasena_hash'] = password;
  } else {
    // sin contraseña inicial
    try { record['contrase��a_hash'] = null; } catch (_) {}
    if (!('contrase��a_hash' in record)) record['contrasena_hash'] = null;
  }

  const [id_usuario] = await db('Usuarios').insert(record);
  return { id_usuario };
}

async function ensureTienda({ nombre, direccion, id_jefe = null }) {
  let row = await db('Tiendas').where({ nombre }).first();
  if (row) return row;
  const [id_tienda] = await db('Tiendas').insert({ nombre, direccion, id_jefe });
  return { id_tienda, nombre, direccion, id_jefe };
}

async function setJefeEnTienda(id_tienda, id_jefe) {
  await db('Tiendas').where({ id_tienda }).update({ id_jefe });
}

async function ensureTrabajadorEnTienda(id_usuario, id_tienda) {
  const exists = await db('Trabajadores').where({ id_trabajador: id_usuario }).first();
  if (exists) return;
  const hoy = new Date().toISOString().slice(0, 10);
  await db('Trabajadores').insert({ id_trabajador: id_usuario, id_tienda, fecha_alta: hoy });
}

async function main() {
  const out = { admins: [], jefes: [], trabajadores: [], tiendas: [] };
  try {
    // Tiendas base (sin jefe inicialmente)
    const tNorte = await ensureTienda({ nombre: 'Tienda Norte', direccion: 'Calle Norte 1' });
    const tSur = await ensureTienda({ nombre: 'Tienda Sur', direccion: 'Avenida Sur 2' });
    out.tiendas.push(tNorte, tSur);

    // Admins
    const a1 = await upsertUsuario({ nombre: 'Admin Uno', email: 'admin1@example.com', password: 'Admin1234', rol: 'admin' });
    const a2 = await upsertUsuario({ nombre: 'Admin Dos', email: 'admin2@example.com', password: 'Admin1234', rol: 'admin' });
    out.admins.push({ id_usuario: a1.id_usuario, email: 'admin1@example.com', password: 'Admin1234' });
    out.admins.push({ id_usuario: a2.id_usuario, email: 'admin2@example.com', password: 'Admin1234' });

    // Jefes (con contraseña) y asignación a tienda
    const j1 = await upsertUsuario({ nombre: 'Jefe Norte', email: 'jefe1@example.com', password: 'Jefe1234', rol: 'jefe' });
    const j2 = await upsertUsuario({ nombre: 'Jefe Sur', email: 'jefe2@example.com', password: 'Jefe1234', rol: 'jefe' });
    await setJefeEnTienda(tNorte.id_tienda || tNorte.ID || tNorte.id, j1.id_usuario);
    await setJefeEnTienda(tSur.id_tienda || tSur.ID || tSur.id, j2.id_usuario);
    out.jefes.push({ id_usuario: j1.id_usuario, email: 'jefe1@example.com', password: 'Jefe1234', tienda: 'Tienda Norte' });
    out.jefes.push({ id_usuario: j2.id_usuario, email: 'jefe2@example.com', password: 'Jefe1234', tienda: 'Tienda Sur' });

    // Trabajadores (sin contraseña inicial, deberán establecerla al primer login)
    const w1 = await upsertUsuario({ nombre: 'Trabajador Norte', email: 'trab1@example.com', password: null, rol: 'trabajador' });
    const w2 = await upsertUsuario({ nombre: 'Trabajador Sur', email: 'trab2@example.com', password: null, rol: 'trabajador' });
    await ensureTrabajadorEnTienda(w1.id_usuario, tNorte.id_tienda || tNorte.ID || tNorte.id);
    await ensureTrabajadorEnTienda(w2.id_usuario, tSur.id_tienda || tSur.ID || tSur.id);
    out.trabajadores.push({ id_usuario: w1.id_usuario, email: 'trab1@example.com', password: '(vacía, establecer en primer login)', tienda: 'Tienda Norte' });
    out.trabajadores.push({ id_usuario: w2.id_usuario, email: 'trab2@example.com', password: '(vacía, establecer en primer login)', tienda: 'Tienda Sur' });

    console.log('Usuarios de prueba creados/asegurados:');
    console.table([
      ...out.admins.map(u => ({ rol: 'admin', ...u })),
      ...out.jefes.map(u => ({ rol: 'jefe', ...u })),
      ...out.trabajadores.map(u => ({ rol: 'trabajador', ...u })),
    ]);
    console.log('\nTiendas:');
    console.table(out.tiendas.map(t => ({ id_tienda: t.id_tienda || t.ID || t.id, nombre: t.nombre })));
  } catch (err) {
    console.error('Error seeding:', err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();

