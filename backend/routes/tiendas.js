const express = require('express');
const router = express.Router();
const db = require('../db/connection');

router.post('/', async (req, res) => {
  const { nombre, direccion, id_jefe } = req.body;
  try {
    await db('Tiendas').insert({ nombre, direccion, id_jefe: id_jefe || null });
    res.status(200).json({ mensaje: 'Tienda creada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear tienda' });
  }
});

router.get('/', async (req, res) => {
  try {
    const tiendas = await db.select('*').from('Tiendas');
    res.json(tiendas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tiendas' });
  }
});

module.exports = router;
