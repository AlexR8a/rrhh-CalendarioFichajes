const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const usuariosRoutes = require('./routes/usuarios');
const authRoutes = require('./routes/auth');
const tiendasRoutes = require('./routes/tiendas');
const turnosRoutes = require('./routes/turnos');
const tiposTurnoRoutes = require('./routes/tipos-turno');
const fichajesRoutes = require('./routes/fichajes');
const planificacionRoutes = require('./routes/planificacion');

// 🔹 NUEVO: rutas de horarios semanales (vista HorariosSemana.html)
const horariosRoutes = require('./routes/horarios');

const app = express();
const PORT = 3000;

// Middlewares globales
app.use(cors());
app.use(bodyParser.json());

// Rutas API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tiendas', tiendasRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/tipos-turno', tiposTurnoRoutes);
app.use('/api/fichajes', fichajesRoutes);
app.use('/api/planificacion', planificacionRoutes);

// 🔹 NUEVO: expone /api/horarios (GET /api/horarios/semana?tienda=ID&inicio=YYYY-MM-DD)
app.use('/api/horarios', horariosRoutes);

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
