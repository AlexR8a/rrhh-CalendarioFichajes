CREATE DATABASE IF NOT EXISTS `rrhh_db`;
USE `rrhh_db`;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS Usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  contraseña_hash VARCHAR(100) NOT NULL,
  rol ENUM('administrador', 'jefe', 'trabajador') NOT NULL
);

-- Tiendas
CREATE TABLE IF NOT EXISTS Tiendas (
  id_tienda INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(100),
  id_jefe INT UNIQUE,
  FOREIGN KEY (id_jefe) REFERENCES Usuarios(id_usuario)
);

-- Trabajadores
CREATE TABLE IF NOT EXISTS Trabajadores (
  id_trabajador INT PRIMARY KEY,
  id_tienda INT,
  fecha_alta DATE,
  FOREIGN KEY (id_trabajador) REFERENCES Usuarios(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES Tiendas(id_tienda)
);

-- Tipos de turno
CREATE TABLE IF NOT EXISTS TiposTurno (
  id_tipo_turno INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  descripcion VARCHAR(9999)
);

-- Turnos
CREATE TABLE IF NOT EXISTS Turnos (
  id_turno INT AUTO_INCREMENT PRIMARY KEY,
  id_tienda INT,
  id_tipo_turno INT,
  hora_inicio TIME,
  hora_fin TIME,
  FOREIGN KEY (id_tienda) REFERENCES Tiendas(id_tienda),
  FOREIGN KEY (id_tipo_turno) REFERENCES TiposTurno(id_tipo_turno)
);

-- Asignaciones de turno
CREATE TABLE IF NOT EXISTS AsignacionesTurno (
  id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT,
  id_turno INT,
  fecha DATE,
  asignado_por INT,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador),
  FOREIGN KEY (id_turno) REFERENCES Turnos(id_turno),
  FOREIGN KEY (asignado_por) REFERENCES Usuarios(id_usuario)
);

-- Asistencias
CREATE TABLE IF NOT EXISTS Asistencias (
  id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT,
  fecha DATE,
  hora_entrada TIME,
  hora_salida TIME,
  fuente ENUM('manual', 'fichaje'),
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador)
);

-- Ausencias
CREATE TABLE IF NOT EXISTS Ausencias (
  id_ausencia INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT,
  fecha_inicio DATE,
  fecha_fin DATE,
  tipo ENUM('enfermedad', 'permiso', 'vacaciones', 'otra'),
  aprobada BOOLEAN DEFAULT FALSE,
  aprobada_por INT,
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_trabajador) REFERENCES Trabajadores(id_trabajador),
  FOREIGN KEY (aprobada_por) REFERENCES Usuarios(id_usuario)
);

-- Historial de cambios
CREATE TABLE IF NOT EXISTS HistorialCambios (
  id_historial INT AUTO_INCREMENT PRIMARY KEY,
  entidad VARCHAR(100),
  id_entidad INT,
  accion VARCHAR(100),
  realizado_por INT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  detalles JSON,
  FOREIGN KEY (realizado_por) REFERENCES Usuarios(id_usuario)
);
