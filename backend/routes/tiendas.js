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

router.get('/vista', async (req, res) => {
  try {
    const vista = await db.select('*').from('VistaTiendas');
    res.json(vista);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la vista de tiendas' });
  }
});

// Actualizar tienda (nombre, direccion, id_jefe) y, si aplica, rol del nuevo jefe
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, id_jefe } = req.body || {};

  const updateData = {};
  if (typeof nombre !== 'undefined') updateData.nombre = nombre;
  if (typeof direccion !== 'undefined') updateData.direccion = direccion;
  if (typeof id_jefe !== 'undefined') updateData.id_jefe = id_jefe || null;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    await db.transaction(async (trx) => {
      const updated = await trx('Tiendas')
        .where({ id_tienda: id })
        .update(updateData);

      if (!updated) {
        throw new Error('Tienda no encontrada');
      }

      // Si se asigna un jefe, actualizar su rol a 'jefe'
      if (typeof id_jefe !== 'undefined' && id_jefe) {
        await trx('Usuarios')
          .where({ id_usuario: id_jefe })
          .update({ rol: 'jefe' });
      }
    });

    res.json({ mensaje: 'Tienda actualizada correctamente' });
  } catch (error) {
    console.error(error);
    const msg = error.message === 'Tienda no encontrada' ? error.message : 'Error al actualizar tienda';
    const code = error.message === 'Tienda no encontrada' ? 404 : 500;
    res.status(code).json({ error: msg });
  }
});


module.exports = router;
