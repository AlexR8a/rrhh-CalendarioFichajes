const express = require('express');
const router = express.Router();
const db = require('../db/connection');

router.post('/', async (req, res) => {
  const { nombre, email, contraseña, rol } = req.body;
  try {
    const contraseña_hash = contraseña; // TODO: usar bcrypt
    await db('Usuarios').insert({
      nombre,
      email,
      contraseña_hash,
      rol
    });
    res.status(200).json({ mensaje: 'Usuario insertado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error insertando el usuario' });
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



module.exports = router;
