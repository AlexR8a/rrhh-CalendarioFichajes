const express = require('express');
const router = express.Router();
const db = require('../db/connection');

router.post('/', async (req, res) => {
  const { nombre, email, contraseña, rol, id_tienda } = req.body;

  try {
    const contraseña_hash = contraseña; // puedes usar bcrypt aquí si quieres
    const [id_usuario] = await db('Usuarios').insert({
      nombre,
      email,
      contraseña_hash,
      rol
    });

    // Si es trabajador, insertamos en la tabla Trabajadores también
    if (rol === 'trabajador') {
      await db('Trabajadores').insert({
        id_trabajador: id_usuario,
        id_tienda,
        fecha_alta: new Date().toISOString().split('T')[0]
      });
    }

    res.json({ mensaje: 'Usuario creado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});


router.get('/', async (req, res) => {
  try {
    const usuarios = await db.select('*').from('VistaUsuarios');
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/vista', async (req, res) => {
  try {
    const vista = await db.select('*').from('VistaUsuariosConTienda');
    res.json(vista);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la vista de usuarios' });
  }
});

// Actualizar rol de un usuario
router.put('/:id/rol', async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body || {};
  if (!rol) return res.status(400).json({ error: 'Rol requerido' });
  try {
    const updated = await db('Usuarios')
      .where({ id_usuario: id })
      .update({ rol });
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Rol actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});




module.exports = router;
