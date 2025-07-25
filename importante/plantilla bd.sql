CREATE DATABASE IF NOT EXISTS rrhh_db;
USE rrhh_db;

-- 🧑 Usuarios
CREATE TABLE IF NOT EXISTS Usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  contraseña_hash VARCHAR(255) NOT NULL,
  rol ENUM('administrador', 'jefe', 'trabajador') NOT NULL,
  consentimiento_datos BOOLEAN DEFAULT FALSE, -- RGPD
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 🏪 Tiendas
CREATE TABLE IF NOT EXISTS Tiendas (
  id_tienda INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(255),
  id_jefe INT,
  FOREIGN KEY (id_jefe) REFERENCES Usuarios(id_usuario)
);

-- 👷 Trabajadores
CREATE TABLE IF NOT EXISTS Trabajadores (
  id_trabajador INT PRIMARY KEY,
  id_tienda INT NOT NULL,
  fecha_alta DATE NOT NULL,
  FOREIGN KEY (id_trabajador) REFERENCES Usuarios(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES Tiendas(id_tienda)
);

-- ⏰ Tipos de Turno
CREATE TABLE IF NOT EXISTS TiposTurno (
  id_tipo_turno INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT
);

-- 🕒 Turnos Generales
CREATE TABLE IF NOT EXISTS Turnos (
  id_turno INT AUTO_INCREMENT PRIMARY KEY,
  id_tienda INT NOT NULL,
  id_tipo_turno INT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  FOREIGN KEY (id_tienda) REFERENCES Tiendas(id_tienda),
  FOREIGN KEY (id_tipo_turno) REFERENCES TiposTurno(id_tipo_turno)
);

-- 📅 Asignaciones de Turno a Trabajadores
CREATE TABLE IF NOT EXISTS AsignacionesTurno (
  id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT NOT NULL,
  id_turno INT NOT NULL,
  fecha DATE NOT NULL,
  asignado_por INT NOT NULL,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador),
  FOREIGN KEY (id_turno) REFERENCES Turnos(id_turno),
  FOREIGN KEY (asignado_por) REFERENCES Usuarios(id_usuario)
);

-- 🟢 Fichajes / Asistencia diaria
CREATE TABLE IF NOT EXISTS Fichajes (
  id_fichaje INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME,
  hora_salida TIME,
  fuente ENUM('manual', 'fichaje') DEFAULT 'fichaje',
  comentario TEXT,
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador)
);

-- ❌ Ausencias (Vacaciones, Permisos, etc.)
CREATE TABLE IF NOT EXISTS Ausencias (
  id_ausencia INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo ENUM('enfermedad', 'permiso', 'vacaciones', 'otra') NOT NULL,
  aprobada BOOLEAN DEFAULT FALSE,
  aprobada_por INT,
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comentario TEXT,
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador),
  FOREIGN KEY (aprobada_por) REFERENCES Usuarios(id_usuario)
);

-- 🗂 Historial de cambios (auditoría)
CREATE TABLE IF NOT EXISTS HistorialCambios (
  id_historial INT AUTO_INCREMENT PRIMARY KEY,
  entidad VARCHAR(100) NOT NULL,         -- p.ej. "Fichajes"
  id_entidad INT NOT NULL,               -- ID del registro afectado
  accion VARCHAR(50) NOT NULL,           -- "insert", "update", "delete"
  realizado_por INT NOT NULL,            -- Usuario que lo hizo
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  detalles JSON,                         -- cambios exactos
  FOREIGN KEY (realizado_por) REFERENCES Usuarios(id_usuario)
);
