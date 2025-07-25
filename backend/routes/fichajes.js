const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Registrar entrada o salida
router.post('/', async (req, res) => {
  const { id_trabajador, tipo } = req.body;
  const fechaHoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const horaAhora = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

  try {
    // Ver si ya hay un fichaje hoy
    const [fichajeHoy] = await db('Fichajes')
      .where({ id_trabajador, fecha: fechaHoy });

    if (!fichajeHoy) {
      if (tipo === 'entrada') {
        await db('Fichajes').insert({
          id_trabajador,
          fecha: fechaHoy,
          hora_entrada: horaAhora,
          fuente: 'fichaje',
        });
        return res.status(201).json({ mensaje: 'Entrada registrada' });
      } else {
        return res.status(400).json({ error: 'Primero debes registrar la entrada' });
      }
    } else {
      if (tipo === 'salida') {
        if (fichajeHoy.hora_salida) {
          return res.status(400).json({ error: 'La salida ya fue registrada' });
        }

        await db('Fichajes')
          .where({ id_fichaje: fichajeHoy.id_fichaje })
          .update({ hora_salida: horaAhora });

        return res.status(200).json({ mensaje: 'Salida registrada' });
      } else {
        return res.status(400).json({ error: 'Ya fichaste entrada hoy' });
      }
    }

  } catch (error) {
    console.error('Error al fichar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener fichajes por trabajador
router.get('/:id_trabajador', async (req, res) => {
  const { id_trabajador } = req.params;

  try {
    const fichajes = await db('Fichajes')
      .where({ id_trabajador })
      .orderBy('fecha', 'desc');

    res.json(fichajes);
  } catch (error) {
    console.error('Error al obtener fichajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ver fichaje de hoy
router.get('/hoy/:id_trabajador', async (req, res) => {
  const { id_trabajador } = req.params;
  const fechaHoy = new Date().toISOString().split('T')[0];

  try {
    const [fichaje] = await db('Fichajes')
      .where({ id_trabajador, fecha: fechaHoy });

    res.json(fichaje || {});
  } catch (error) {
    console.error('Error al obtener fichaje de hoy:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
