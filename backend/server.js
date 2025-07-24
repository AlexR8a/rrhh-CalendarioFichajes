const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const usuariosRoutes = require('./routes/usuarios');
const tiendasRoutes = require('./routes/tiendas');
const turnosRoutes = require('./routes/turnos');
const tiposTurnoRoutes = require('./routes/tipos-turno');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tiendas', tiendasRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/tipos-turno', tiposTurnoRoutes);


app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
