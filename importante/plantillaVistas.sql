CREATE OR REPLACE VIEW VistaTiendas AS
SELECT
  ti.id_tienda,
  ti.nombre AS nombre_tienda,
  ti.direccion,
  j.id_usuario AS id_jefe,
  j.nombre AS nombre_jefe,
  j.email AS email_jefe
FROM Tiendas ti
LEFT JOIN Usuarios j ON ti.id_jefe = j.id_usuario;

CREATE OR REPLACE VIEW VistaUsuariosConTienda AS
SELECT
  u.id_usuario,
  u.nombre,
  u.email,
  u.rol,
  t.id_tienda,
  ti.nombre AS nombre_tienda,
  t.fecha_alta
FROM Usuarios u
LEFT JOIN Trabajadores t ON u.id_usuario = t.id_trabajador
LEFT JOIN Tiendas ti ON t.id_tienda = ti.id_tienda;
