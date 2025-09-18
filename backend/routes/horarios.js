// backend/routes/horarios.js
const express = require('express');
const router = express.Router();

// GET /api/horarios/semana?tienda=ID&inicio=YYYY-MM-DD
router.get('/semana', (req, res) => {
  const { tienda, inicio } = req.query;

  // ⚠️ Si faltan parámetros, devolvemos error
  if (!tienda || !inicio) {
    return res.status(400).json({ error: 'Faltan parámetros tienda o inicio' });
  }

  // Datos simulados (mock) para probar el front
  const empleados = [
    { id_trabajador: 1, nombre: 'Ana' },
    { id_trabajador: 2, nombre: 'Luis' }
  ];

  const asignaciones = [
    { id_trabajador: 1, nombre: 'Ana', fecha: inicio, hora_inicio: '09:00', hora_fin: '14:00' },
    { id_trabajador: 2, nombre: 'Luis', fecha: inicio, hora_inicio: '10:30', hora_fin: '18:00' },
    { id_trabajador: 1, nombre: 'Ana', fecha: '2025-09-16', hora_inicio: '16:00', hora_fin: '20:00' }
  ];

  res.json({ empleados, asignaciones });
});

module.exports = router;
