const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

function isAdminLike(req) {
  const rol = String(req.user?.rol || '').toLowerCase();
  return rol === 'admin' || rol === 'administrador';
}

function isEncargadoLike(role) {
  const rol = String(role || '').toLowerCase();
  // admitir alias del rol encargado
  return rol === 'encargado' || rol === 'jefe';
}

async function ensureTables() {
  const hasCodes = await db.schema.hasTable('TurnosCodigo');
  if (!hasCodes) {
    await db.schema.createTable('TurnosCodigo', (t) => {
      t.increments('id_turno_codigo').primary();
      t.string('codigo', 16).notNullable().unique();
      t.string('descripcion', 255).defaultTo('');
      t.decimal('horas', 5, 2).notNullable().defaultTo(0);
      t.boolean('activo').notNullable().defaultTo(true);
      t.timestamp('creado_en').defaultTo(db.fn.now());
      t.timestamp('actualizado_en').defaultTo(db.fn.now());
    });
  }
  const hasAsign = await db.schema.hasTable('PlanificacionAsignaciones');
  if (!hasAsign) {
    await db.schema.createTable('PlanificacionAsignaciones', (t) => {
      t.increments('id_asignacion').primary();
      t.integer('id_trabajador').notNullable();
      t.date('fecha').notNullable();
      t.integer('id_turno_codigo').unsigned().nullable();
      t.foreign('id_turno_codigo').references('id_turno_codigo').inTable('TurnosCodigo');
      t.unique(['id_trabajador', 'fecha']);
      t.index(['fecha']);
    });
  }
}

ensureTables().catch((e) => console.error('[planificacion] ensureTables error:', e));

// Logger básico para este router
router.use((req, _res, next) => {
  try {
    const meta = { uid: req.user?.uid, rol: req.user?.rol };
    console.log(`[planificacion] ${req.method} ${req.url}`, meta);
  } catch (_) {}
  next();
});

// Codigos de turno: listar
router.get('/codigos', async (req, res) => {
  try {
    const rows = await db('TurnosCodigo').where({ activo: 1 }).orderBy('codigo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener códigos' });
  }
});

// Crear/actualizar código de turno (admin)
router.post('/codigos', authenticate, async (req, res) => {
  try {
    // Permitir tambi en encargado/jefe, no solo admin
    const rol = String(req.user?.rol || '').toLowerCase();
    if (!isAdminLike(req) && !isEncargadoLike(rol)) return res.status(403).json({ error: 'No autorizado' });
    let { id_turno_codigo, codigo, descripcion, horas, activo } = req.body || {};
    codigo = String(codigo || '').trim();
    if (!codigo) return res.status(400).json({ error: 'Código requerido' });
    horas = Number(horas);
    if (!Number.isFinite(horas) || horas < 0 || horas > 24) {
      return res.status(400).json({ error: 'Horas debe ser un número entre 0 y 24' });
    }
    const data = { codigo, descripcion: String(descripcion || ''), horas };
    if (typeof activo !== 'undefined') data.activo = !!activo;
    if (id_turno_codigo) {
      await db('TurnosCodigo').where({ id_turno_codigo }).update(data);
      return res.json({ mensaje: 'Código actualizado' });
    }
    const [id] = await db('TurnosCodigo').insert(data);
    return res.status(201).json({ mensaje: 'Código creado', id_turno_codigo: id });
  } catch (err) {
    if (String(err?.message || '').includes('ER_DUP_ENTRY')) {
      return res.status(400).json({ error: 'Código duplicado' });
    }
    res.status(500).json({ error: 'Error al guardar código' });
  }
});

// Desactivar código (admin)
router.delete('/codigos/:id', authenticate, async (req, res) => {
  try {
    const rol = String(req.user?.rol || '').toLowerCase();
    if (!isAdminLike(req) && !isEncargadoLike(rol)) return res.status(403).json({ error: 'No autorizado' });
    const { id } = req.params;
    const updated = await db('TurnosCodigo').where({ id_turno_codigo: id }).update({ activo: 0 });
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Código desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar código' });
  }
});

// Años sugeridos (para selector)
router.get('/anios', async (req, res) => {
  const now = new Date().getFullYear();
  const anios = [];
  for (let y = now - 1; y <= now + 2; y++) anios.push({ valor: y, activo: 1 });
  res.json(anios);
});

// Empleados por tienda
router.get('/empleados', async (req, res) => {
  try {
    const tienda = parseInt(req.query.tienda, 10);
    if (!tienda) return res.status(400).json({ error: 'Parámetro tienda requerido' });
    const empleados = await db('Trabajadores as T')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .select('T.id_trabajador', 'U.nombre')
      .where('T.id_tienda', tienda)
      .orderBy('U.nombre');
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// Obtener asignaciones del año por tienda
router.get('/asignaciones', async (req, res) => {
  try {
    const tienda = parseInt(req.query.tienda, 10);
    const anio = parseInt(req.query.anio, 10);
    if (!tienda || !anio) return res.status(400).json({ error: 'Parámetros tienda y anio requeridos' });
    const empleados = await db('Trabajadores as T')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .select('T.id_trabajador', 'U.nombre')
      .where('T.id_tienda', tienda)
      .orderBy('U.nombre');
    const ids = empleados.map((e) => e.id_trabajador);
    let asignaciones = [];
    if (ids.length) {
      asignaciones = await db('PlanificacionAsignaciones')
        .whereIn('id_trabajador', ids)
        .whereRaw('YEAR(fecha) = ?', [anio])
        .select('id_asignacion', 'id_trabajador', 'fecha', 'id_turno_codigo');
    }
    const codigos = await db('TurnosCodigo').where({ activo: 1 }).orderBy('codigo');
    res.json({ empleados, asignaciones, codigos });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Crear/actualizar/eliminar asignación de celda
router.put('/asignacion', authenticate, async (req, res) => {
  try {
    const { id_trabajador, fecha, id_turno_codigo } = req.body || {};
    if (!id_trabajador || !fecha) return res.status(400).json({ error: 'id_trabajador y fecha requeridos' });
    const rol = String(req.user?.rol || '').toLowerCase();
    if (!isAdminLike(req)) {
      if (!isEncargadoLike(rol)) return res.status(403).json({ error: 'No autorizado' });
      // si es encargado/jefe, debe pertenecer a su tienda
      const belongs = await db('Trabajadores as T').join('Tiendas as S', 'S.id_tienda', 'T.id_tienda')
        .where('T.id_trabajador', id_trabajador).andWhere('S.id_jefe', req.user?.uid).first();
      if (!belongs) return res.status(403).json({ error: 'No autorizado' });
    }
    if (id_turno_codigo) {
      const code = await db('TurnosCodigo').where({ id_turno_codigo, activo: 1 }).first();
      if (!code) return res.status(400).json({ error: 'Código inválido' });
      const existing = await db('PlanificacionAsignaciones').where({ id_trabajador, fecha }).first();
      if (existing) {
        await db('PlanificacionAsignaciones').where({ id_asignacion: existing.id_asignacion }).update({ id_turno_codigo });
        return res.json({ mensaje: 'Asignación actualizada' });
      } else {
        const [id_asignacion] = await db('PlanificacionAsignaciones').insert({ id_trabajador, fecha, id_turno_codigo });
        return res.status(201).json({ mensaje: 'Asignación creada', id_asignacion });
      }
    } else {
      const deleted = await db('PlanificacionAsignaciones').where({ id_trabajador, fecha }).del();
      return res.json({ mensaje: deleted ? 'Asignación eliminada' : 'No había asignación' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar asignación' });
  }
});

// Bulk de asignaciones (aplicar reglas)
router.post('/asignaciones/bulk', authenticate, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    console.log('[planificacion] bulk inside route', { uid: req.user?.uid, rol: req.user?.rol, items: items.length, sample: items[0] });
    if (!items.length) return res.status(400).json({ error: 'items vacío' });
    const rol = String(req.user?.rol || '').toLowerCase();
    const admin = isAdminLike(req);
    const okCodes = new Set((await db('TurnosCodigo').where({ activo: 1 })).map((c) => c.id_turno_codigo));
    await db.transaction(async (trx) => {
      for (const it of items) {
        const id_trabajador = it.id_trabajador;
        const fecha = it.fecha;
        const id_turno_codigo = it.id_turno_codigo || null;
        if (!id_trabajador || !fecha) continue;
        if (!admin) {
          if (!isEncargadoLike(rol)) continue;
          const allowed = await trx('Trabajadores as T').join('Tiendas as S','S.id_tienda','T.id_tienda')
            .where('T.id_trabajador', id_trabajador).andWhere('S.id_jefe', req.user?.uid).first();
          if (!allowed) continue;
        }
        if (id_turno_codigo && !okCodes.has(id_turno_codigo)) continue;
        const existing = await trx('PlanificacionAsignaciones').where({ id_trabajador, fecha }).first();
        if (id_turno_codigo) {
          if (existing) await trx('PlanificacionAsignaciones').where({ id_asignacion: existing.id_asignacion }).update({ id_turno_codigo });
          else await trx('PlanificacionAsignaciones').insert({ id_trabajador, fecha, id_turno_codigo });
        } else if (existing) {
          await trx('PlanificacionAsignaciones').where({ id_asignacion: existing.id_asignacion }).del();
        }
      }
    });
    res.json({ mensaje: 'Asignaciones procesadas' });
  } catch (err) {
    res.status(500).json({ error: 'Error en asignación masiva' });
  }
});

// Regla automática: aplicar patrón semanal repetido en un rango
router.post('/auto/patron-semanal', authenticate, async (req, res) => {
  try {
    const { tienda, desde, hasta, pattern, empleados } = req.body || {};
    if (!tienda || !desde || !pattern || !Array.isArray(pattern) || pattern.length !== 7) {
      return res.status(400).json({ error: 'Parámetros requeridos: tienda, desde, pattern[7]' });
    }
    const rol = String(req.user?.rol || '').toLowerCase();
    if (!isAdminLike(req) && !isEncargadoLike(rol)) return res.status(403).json({ error: 'No autorizado' });
    const empList = Array.isArray(empleados) && empleados.length
      ? await db('Trabajadores').whereIn('id_trabajador', empleados)
      : await db('Trabajadores').where({ id_tienda: tienda });
    const codeMap = new Map((await db('TurnosCodigo').where({ activo: 1 })).map(c => [String(c.codigo).toUpperCase(), c.id_turno_codigo]));
    // Normalizar patrón: puede venir como id o código
    const patIds = pattern.map(p => {
      if (p == null || p === '') return null;
      if (Number.isFinite(p)) return p;
      const k = String(p).toUpperCase().trim();
      return codeMap.get(k) || null;
    });
    if (patIds.length !== 7) return res.status(400).json({ error: 'pattern debe tener 7 elementos' });
    const start = new Date(`${desde}T00:00:00`);
    const end = hasta ? new Date(`${hasta}T00:00:00`) : new Date(start.getFullYear(), 11, 31);
    const items = [];
    for (const emp of empList) {
      let d = new Date(start);
      while (d <= end) {
        const dow = (d.getDay() + 6) % 7; // 0=lunes
        const idc = patIds[dow];
        const iso = d.toISOString().slice(0,10);
        items.push({ id_trabajador: emp.id_trabajador || emp.id, fecha: iso, id_turno_codigo: idc });
        d.setDate(d.getDate() + 1);
      }
    }
    req.body = { items };
    return router.handle({ ...req, url: '/asignaciones/bulk', method: 'POST' }, res);
  } catch (err) {
    res.status(500).json({ error: 'Error al aplicar patrón semanal' });
  }
});

// Horas agregadas por trabajador (y por mes) para una tienda y año
router.get('/horas', async (req, res) => {
  try {
    const tienda = parseInt(req.query.tienda, 10);
    const anio = parseInt(req.query.anio, 10);
    if (!tienda || !anio) return res.status(400).json({ error: 'Parámetros tienda y anio requeridos' });
    const rows = await db('PlanificacionAsignaciones as P')
      .join('Trabajadores as T', 'T.id_trabajador', 'P.id_trabajador')
      .join('Usuarios as U', 'U.id_usuario', 'T.id_trabajador')
      .leftJoin('TurnosCodigo as C', 'C.id_turno_codigo', 'P.id_turno_codigo')
      .where('T.id_tienda', tienda)
      .whereRaw('YEAR(P.fecha) = ?', [anio])
      .groupBy('P.id_trabajador', 'U.nombre', db.raw('MONTH(P.fecha)'))
      .select(
        'P.id_trabajador',
        'U.nombre',
        db.raw('MONTH(P.fecha) as mes'),
        db.raw('COALESCE(SUM(C.horas),0) as horas')
      );
    const map = new Map();
    for (const r of rows){
      const id = r.id_trabajador; const mes = String(r.mes).padStart(2,'0'); const h = Number(r.horas||0);
      if (!map.has(id)) map.set(id, { id_trabajador: id, nombre: r.nombre, total: 0, meses: {} });
      const obj = map.get(id); obj.meses[mes] = h; obj.total += h;
    }
    res.json({ tienda, anio, empleados: Array.from(map.values()) });
  } catch (err) {
    console.error('[planificacion] /horas error', err);
    res.status(500).json({ error: 'Error al calcular horas' });
  }
});

module.exports = router;
