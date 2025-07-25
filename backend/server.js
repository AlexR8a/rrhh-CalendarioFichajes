const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const usuariosRoutes = require('./routes/usuarios');
const tiendasRoutes = require('./routes/tiendas');
const turnosRoutes = require('./routes/turnos');
const tiposTurnoRoutes = require('./routes/tipos-turno');
const fichajesRoutes = require('./routes/fichajes'); 

const app = express();
const PORT = 3000;

// Middlewares globales
app.use(cors());
app.use(bodyParser.json());

// Rutas API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tiendas', tiendasRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/tipos-turno', tiposTurnoRoutes);
app.use('/api/fichajes', fichajesRoutes); A

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
