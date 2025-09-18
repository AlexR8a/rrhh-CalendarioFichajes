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

function normalizeId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) return asNumber;
    return trimmed;
  }
  const converted = Number(value);
  if (!Number.isNaN(converted)) return converted;
  return String(value);
}

function idsEqual(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a) === String(b);
}
function toISODate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      const rows = await db('PlanificacionAsignaciones')
        .whereIn('id_trabajador', ids)
        .whereRaw('YEAR(fecha) = ?', [anio])
        .select('id_asignacion', 'id_trabajador', 'fecha', 'id_turno_codigo');
      asignaciones = rows.map((row) => ({
        ...row,
        fecha: toISODate(row.fecha)
      }));
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

// Planificacion anual individual por trabajador
router.get(['/usuario', '/usuario/:id'], authenticate, async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
    const currentId = normalizeId(req.user?.uid);
    const rolRaw = req.user?.rol;
    const admin = isAdminLike(req);
    const encargado = isEncargadoLike(rolRaw);
    if (currentId == null) return res.status(401).json({ error: 'Usuario sin identificador' });

    const paramId = normalizeId(req.params?.id);
    const targetId = paramId == null ? currentId : paramId;
    if (targetId == null) return res.status(400).json({ error: 'Trabajador invalido' });
    if (!idsEqual(targetId, currentId) && !(admin || encargado)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const trabajador = await db('Usuarios as U')
      .leftJoin('Trabajadores as T', 'T.id_trabajador', 'U.id_usuario')
      .leftJoin('Tiendas as S', 'S.id_tienda', 'T.id_tienda')
      .where('U.id_usuario', targetId)
      .first(
        'U.id_usuario as id_usuario',
        'U.nombre',
        'U.email',
        'U.rol',
        'T.id_trabajador',
        'T.id_tienda',
        'S.nombre as tienda_nombre',
        'S.id_jefe'
      );
    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });

    let workerId = normalizeId(trabajador.id_trabajador);
    if (workerId == null) workerId = normalizeId(trabajador.id_usuario);
    if (workerId == null) return res.status(404).json({ error: 'Trabajador no encontrado' });

    if (encargado && !admin && !idsEqual(workerId, currentId)) {
      const jefeId = normalizeId(trabajador.id_jefe);
      if (!idsEqual(jefeId, currentId)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const asignacionesRaw = await db('PlanificacionAsignaciones as P')
      .leftJoin('TurnosCodigo as C', 'C.id_turno_codigo', 'P.id_turno_codigo')
      .where('P.id_trabajador', workerId)
      .whereRaw('YEAR(P.fecha) = ?', [anio])
      .orderBy('P.fecha')
      .select(
        'P.fecha',
        'P.id_turno_codigo',
        'C.codigo',
        'C.descripcion',
        db.raw('COALESCE(C.horas, 0) as horas')
      );

    const asignaciones = asignacionesRaw.map((row) => ({
      fecha: toISODate(row.fecha),
      id_turno_codigo: row.id_turno_codigo || null,
      codigo: row.codigo || null,
      descripcion: row.descripcion || '',
      horas: Number(row.horas || 0)
    }));

    const resumen = {
      totalHoras: 0,
      meses: {},
      semanas: {}
    };
    const codigosUsados = new Map();
    const toDate = (iso) => {
      const d = new Date(iso + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const mondayKey = (iso) => {
      const d = toDate(iso);
      if (!d) return null;
      const offset = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - offset);
      return d.toISOString().slice(0, 10);
    };
    for (const row of asignaciones) {
      if (!row || !row.fecha) continue;
      const horas = Number(row.horas || 0);
      const mes = row.fecha.slice(5, 7);
      if (!resumen.meses[mes]) resumen.meses[mes] = { horas: 0, dias: 0 };
      resumen.meses[mes].horas += horas;
      if (row.id_turno_codigo) resumen.meses[mes].dias += 1;
      resumen.totalHoras += horas;
      const key = mondayKey(row.fecha);
      if (key) {
        if (!resumen.semanas[key]) {
          const start = toDate(key);
          const end = start ? new Date(start) : null;
          if (end) end.setDate(end.getDate() + 6);
          resumen.semanas[key] = {
            desde: key,
            hasta: end ? end.toISOString().slice(0, 10) : null,
            horas: 0,
            dias: 0
          };
        }
        resumen.semanas[key].horas += horas;
        if (row.id_turno_codigo) resumen.semanas[key].dias += 1;
      }
      if (row.id_turno_codigo && row.codigo) {
        if (!codigosUsados.has(row.id_turno_codigo)) {
          codigosUsados.set(row.id_turno_codigo, {
            id_turno_codigo: row.id_turno_codigo,
            codigo: row.codigo,
            descripcion: row.descripcion || '',
            horas
          });
        }
      }
    }

    const rawCodigos = await db('TurnosCodigo').where({ activo: 1 }).orderBy('codigo');
    const codigos = rawCodigos.map((c) => ({ ...c, horas: Number(c.horas || 0) }));
    const usuarioId = normalizeId(trabajador.id_usuario);
    const tiendaId = normalizeId(trabajador.id_tienda);

    res.json({
      anio,
      trabajador: {
        id_trabajador: workerId,
        id_usuario: usuarioId,
        nombre: trabajador.nombre,
        email: trabajador.email,
        rol: trabajador.rol || null,
        id_tienda: tiendaId,
        tienda: trabajador.tienda_nombre || null
      },
      asignaciones,
      resumen,
      codigos,
      codigosUsados: Array.from(codigosUsados.values())
    });
  } catch (err) {
    console.error('[planificacion] /usuario error', err);
    res.status(500).json({ error: 'Error al obtener planificacion del trabajador' });
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
