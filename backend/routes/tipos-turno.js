const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener tipos de turno
router.get('/', async (req, res) => {
  try {
    const tipos = await db('TiposTurno');
    res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos de turno:', error);
    res.status(500).json({ error: 'Error al obtener tipos de turno' });
  }
});

module.exports = router;
