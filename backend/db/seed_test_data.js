const db=require('./connection');
async function getPwdCol(){try{const i=await db('Usuarios').columnInfo();for(const c of ['contrasena_hash','contrase\u00f1a_hash','password']){if(i[c])return c;}}catch(_){}return null}
async function upsertUser({nombre,email,password,rol}){const e=await db('Usuarios').where({email}).first();if(e)return{ id_usuario:e.id_usuario||e.id||e.ID};const r={nombre,email,rol};const col=await getPwdCol();if(col)r[col]=(typeof password==='string'?password:'');const [id_usuario]=await db('Usuarios').insert(r);return{ id_usuario}}
async function ensureStore({nombre,direccion,id_jefe=null}){let t=await db('Tiendas').where({nombre}).first();if(t)return t;const [id_tienda]=await db('Tiendas').insert({nombre,direccion,id_jefe});return{ id_tienda,nombre,direccion,id_jefe}}
async function setStoreManager(id_tienda,id_jefe){await db('Tiendas').where({id_tienda}).update({id_jefe})}
async function ensureWorkerInStore(id_usuario,id_tienda){const ex=await db('Trabajadores').where({id_trabajador:id_usuario}).first();if(ex)return;const hoy=new Date().toISOString().slice(0,10);await db('Trabajadores').insert({id_trabajador:id_usuario,id_tienda,fecha_alta:hoy})}
async function ensureTipoTurno(nombre){const r=await db('TiposTurno').where({nombre}).first();if(r)return r.id_tipo_turno||r.id||r.ID;const [id]=await db('TiposTurno').insert({nombre});return id}
async function ensureTurno({id_tienda,id_tipo_turno=null,hora_inicio,hora_fin}){
  let q = db('Turnos').where({ id_tienda, hora_inicio, hora_fin });
  if (id_tipo_turno) q = q.andWhere({ id_tipo_turno });
  const existing = await q.first();
  let id_turno = existing ? existing.id_turno || existing.id || existing.ID : null;
  if (!id_turno){
    const inserted = await db('Turnos').insert({ id_tienda, id_tipo_turno, hora_inicio, hora_fin });
    if (Array.isArray(inserted) && inserted.length){
      const first = inserted[0];
      id_turno = typeof first === 'object' ? first.id_turno || first.id || first.ID : first;
    } else {
      id_turno = inserted;
    }
  }
  if (!id_turno) return id_turno;
  try {
    const tramo = await db('TurnosTramos').where({ id_turno }).first();
    if (!tramo){
      await db('TurnosTramos').insert({ id_turno, orden: 1, hora_inicio, hora_fin });
    }
  } catch (_) {
    /* tabla opcional durante migraciones */
  }
  return id_turno;
}
async function ensureTurnoCodigo({codigo,descripcion='',horas=0,activo=true}){const e=await db('TurnosCodigo').where({codigo}).first();if(e){return{created:false,record:{id_turno_codigo:e.id_turno_codigo||e.id||e.ID,codigo:e.codigo,descripcion:e.descripcion,horas:Number(e.horas??horas),activo:e.activo!==undefined?!!e.activo:true}}}const inserted=await db('TurnosCodigo').insert({codigo,descripcion,horas,activo});let id=inserted&&inserted[0];if(id&&typeof id==='object'){id=id.id_turno_codigo||id.id||id.ID}if(!id){const row=await db('TurnosCodigo').where({codigo}).first();return{created:true,record:{id_turno_codigo:row?.id_turno_codigo||row?.id||row?.ID,codigo:row?.codigo??codigo,descripcion:row?.descripcion??descripcion,horas:Number(row?.horas??horas),activo:row?.activo!==undefined?!!row?.activo:true}}}return{created:true,record:{id_turno_codigo:id,codigo,descripcion,horas:Number(horas),activo}}}
function mondayOfWeek(s){const d=new Date(`${s}T00:00:00`);const g=d.getDay();const diff=(g===0?-6:1-g);d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10)}
function weekDates(a){const r=[];const s=new Date(`${a}T00:00:00`);for(let i=0;i<7;i++){const d=new Date(s);d.setDate(d.getDate()+i);r.push(d.toISOString().slice(0,10))}return r}
async function upsertReq({id_turno,fecha,cantidad}){const e=await db('RequerimientosTurno').where({id_turno,fecha}).first();if(e){await db('RequerimientosTurno').where({id_turno,fecha}).update({cantidad})}else{await db('RequerimientosTurno').insert({id_turno,fecha,cantidad})}}
async function ensureAsig({id_trabajador,id_turno,fecha,asignado_por=null}){const e=await db('AsignacionesTurno').where({id_trabajador,id_turno,fecha}).first();if(e)return e.id_asignacion||e.id||e.ID;const [id]=await db('AsignacionesTurno').insert({id_trabajador,id_turno,fecha,asignado_por});return id}
async function upsertPlanificacionAsignacion({id_trabajador,fecha,id_turno_codigo=null}){const e=await db('PlanificacionAsignaciones').where({id_trabajador,fecha}).first();if(e){const id=e.id_asignacion||e.id||e.ID;const mismo=(e.id_turno_codigo===id_turno_codigo)||(!e.id_turno_codigo&&id_turno_codigo==null);if(!mismo)await db('PlanificacionAsignaciones').where({id_asignacion:id}).update({id_turno_codigo});return{id_asignacion:id,created:false,updated:!mismo}}const inserted=await db('PlanificacionAsignaciones').insert({id_trabajador,fecha,id_turno_codigo});let id=inserted&&inserted[0];if(id&&typeof id==='object'){id=id.id_asignacion||id.id||id.ID}if(!id){const row=await db('PlanificacionAsignaciones').where({id_trabajador,fecha}).first();id=row?.id_asignacion||row?.id||row?.ID}return{id_asignacion:id,created:true,updated:false}}
async function ensureFichaje({id_trabajador,fecha,hora_entrada=null,hora_salida=null,fuente='fichaje'}){const e=await db('Fichajes').where({id_trabajador,fecha}).first();if(e){const p={};if(hora_entrada&&!e.hora_entrada)p.hora_entrada=hora_entrada;if(hora_salida&&!e.hora_salida)p.hora_salida=hora_salida;if(Object.keys(p).length)await db('Fichajes').where({id_fichaje:e.id_fichaje}).update(p);return e.id_fichaje||e.id||e.ID}const [id]=await db('Fichajes').insert({id_trabajador,fecha,hora_entrada,hora_salida,fuente});return id}

// Añade este helper arriba, junto al resto de helpers
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

// ====== REEMPLAZA TODO TU main() POR ESTO ======
async function main(){try{
  // ---- 1) Crear TIENDAS ----
  const tiendasSeed = [
    { nombre:'Tienda Norte',  direccion:'Calle Norte 1' },
    { nombre:'Tienda Sur',    direccion:'Avenida Sur 2' },
    { nombre:'Tienda Centro', direccion:'Plaza Mayor 3' },
    { nombre:'Tienda Este',   direccion:'Ronda del Este 4' },
  ];
  const tiendas = [];
  for(const t of tiendasSeed){
    const ti = await ensureStore(t);
    tiendas.push({ ...ti, id_tienda: ti.id_tienda||ti.ID||ti.id, nombre: t.nombre });
  }

  // ---- 2) Crear ADMINS (se mantienen 2) ----
  const admin1 = await upsertUser({nombre:'Admin Uno', email:'admin1@example.com', password:'Admin1234', rol:'administrador'});
  await upsertUser({nombre:'Admin Dos', email:'admin2@example.com', password:'Admin1234', rol:'administrador'});

  // ---- 3) Crear JEFES (uno por tienda) + asignarlos ----
  const jefes = [];
  for(const t of tiendas){
    const email = `jefe.${t.nombre.toLowerCase().split(' ').join('') }@example.com`;
    const jefe  = await upsertUser({ nombre:`Jefe ${t.nombre.split(' ')[1]||t.nombre}`, email, password:'Jefe1234', rol:'jefe' });
    await setStoreManager(t.id_tienda, jefe.id_usuario);
    jefes.push({ tienda: t, jefe });
  }

  // ---- 4) Crear TRABAJADORES por tienda ----
  // Cambia el número para crear más o menos por tienda
  const trabajadoresPorTienda = 5; // p.ej. 5 trabajadores por tienda
  const trabajadores = []; // {id_usuario, id_tienda}
  for(const t of tiendas){
    for(let i=1;i<=trabajadoresPorTienda;i++){
      const nombre = `Trabajador ${t.nombre.split(' ')[1]||t.nombre} ${i}`;
      const email  = `trab.${t.nombre.toLowerCase().split(' ').join('')}.${i}@example.com`;
      const w = await upsertUser({ nombre, email, password:null, rol:'trabajador' });
      await ensureWorkerInStore(w.id_usuario, t.id_tienda);
      trabajadores.push({ id_usuario:w.id_usuario, id_tienda:t.id_tienda, nombre, tienda:t.nombre });
    }
  }

  // ---- 5) Códigos base para planificación anual ----
  const turnosCodigoSeed = [
    { codigo:'M',     descripcion:'Turno de mañana (4h)',      horas:4 },
    { codigo:'T',     descripcion:'Turno de tarde (4h)',      horas:4 },
    { codigo:'C',     descripcion:'Turno completo (8h)',      horas:8 },
    { codigo:'LIBRE', descripcion:'Día libre / descanso',      horas:0 },
    { codigo:'VAC',   descripcion:'Vacaciones / ausencias',    horas:0 }
  ];
  const turnosCodigo = [];
  for(const tc of turnosCodigoSeed){
    const res = await ensureTurnoCodigo(tc);
    turnosCodigo.push({ ...res.record, creado: res.created });
  }
  const turnosCodigoMap = new Map(turnosCodigo.map(tc=>[tc.codigo, tc]));

  // ---- 6) Tipos de turno (más variados) ----
  const tipoCaja   = await ensureTipoTurno('Caja');
  const tipoRepo   = await ensureTipoTurno('Reposición');
  const tipoLimp   = await ensureTipoTurno('Limpieza');
  const tipoOnline = await ensureTipoTurno('Online');

  // Plantillas de horarios por tipo (no cruzamos medianoche)
  // Ajusta/añade los que quieras
  const plantillas = [
    { tipo: tipoCaja,   etiqueta:'Caja Mañana',    hora_inicio:'09:00', hora_fin:'13:00' },
    { tipo: tipoCaja,   etiqueta:'Caja Mediodía',  hora_inicio:'10:00', hora_fin:'14:00' },
    { tipo: tipoRepo,   etiqueta:'Repo Tarde',     hora_inicio:'15:00', hora_fin:'19:00' },
    { tipo: tipoLimp,   etiqueta:'Limpieza Tarde', hora_inicio:'18:00', hora_fin:'22:00' },
    { tipo: tipoOnline, etiqueta:'Online Mañana',  hora_inicio:'08:00', hora_fin:'12:00' },
  ];

  // ---- 7) Crear TURNOS por cada tienda siguiendo las plantillas ----
  // Guardamos ids de turnos por tienda y etiqueta para asignaciones posteriores
  const turnosPorTienda = new Map(); // key id_tienda -> array de {id_turno, tipo, etiqueta}
  for(const t of tiendas){
    const arr = [];
    for(const pl of plantillas){
      const id_turno = await ensureTurno({
        id_tienda: t.id_tienda,
        id_tipo_turno: pl.tipo,
        hora_inicio: pl.hora_inicio,
        hora_fin: pl.hora_fin,
      });
      arr.push({ id_turno, tipo: pl.tipo, etiqueta: pl.etiqueta });
    }
    turnosPorTienda.set(t.id_tienda, arr);
  }

  // ---- 8) Requerimientos de la SEMANA actual para TODOS los turnos ----
  const hoy   = new Date().toISOString().slice(0,10);
  const lunes = mondayOfWeek(hoy);
  const fechas = weekDates(lunes); // 7 días

  // Cantidades por tipo "aproximadas"
  const cantidadPorTipo = new Map([
    [tipoCaja,   2],
    [tipoRepo,   2],
    [tipoLimp,   1],
    [tipoOnline, 1],
  ]);

  for(const t of tiendas){
    const turnos = turnosPorTienda.get(t.id_tienda);
    for(const tr of turnos){
      for(const f of fechas){
        const cant = cantidadPorTipo.get(tr.tipo) ?? 1;
        await upsertReq({ id_turno: tr.id_turno, fecha: f, cantidad: cant });
      }
    }
  }

  // ---- 9) Planificación anual de ejemplo para visualización inicial ----
  const planFechas = fechas.slice(0, Math.min(5, fechas.length));
  const planCodigos = ['M','T','C','LIBRE'].filter(c=>turnosCodigoMap.has(c));
  let planificacionesCreadas = 0;
  let planificacionesActualizadas = 0;
  const planificacionEjemplo = [];
  if(planFechas.length && planCodigos.length){
    for(const t of tiendas){
      const workers = trabajadores.filter(w=>w.id_tienda===t.id_tienda).slice(0,3);
      for(let wi=0;wi<workers.length;wi++){
        const trabajador = workers[wi];
        for(let di=0;di<planFechas.length;di++){
          const codigo = planCodigos[(wi + di) % planCodigos.length];
          const codigoInfo = turnosCodigoMap.get(codigo);
          if(!codigoInfo) continue;
          const planRes = await upsertPlanificacionAsignacion({ id_trabajador:trabajador.id_usuario, fecha:planFechas[di], id_turno_codigo:codigoInfo.id_turno_codigo });
          if(planRes.created) planificacionesCreadas++;
          else if(planRes.updated) planificacionesActualizadas++;
          if(planificacionEjemplo.length<10){
            planificacionEjemplo.push({ trabajador:trabajador.id_usuario, fecha:planFechas[di], codigo });
          }
        }
      }
    }
  }

  // ---- 10) Asignaciones de ejemplo (Lu-Vi) haciendo un reparto round-robin de trabajadores en su tienda ----
  // Para cada tienda: recorrer trabajadores y asignarlos a turnos distintos durante la semana
  for(const t of tiendas){
    const jefe = jefes.find(j=>j.tienda.id_tienda===t.id_tienda)?.jefe;
    const workers = trabajadores.filter(w=>w.id_tienda===t.id_tienda);
    const turnos  = turnosPorTienda.get(t.id_tienda);

    // Usamos días laborables (Lu-Vi) -> fechas[0..4]
    for(let di=0; di<5; di++){
      const fecha = fechas[di];
      // Para cada turno del día, asignamos a uno o dos trabajadores si hay
      for(const tr of turnos){
        // número de personas a cubrir aproximado (como requerimientos)
        const cupo = cantidadPorTipo.get(tr.tipo) ?? 1;
        for(let k=0;k<cupo;k++){
          const w = workers[(di + k) % workers.length];
          await ensureAsig({
            id_trabajador: w.id_usuario,
            id_turno: tr.id_turno,
            fecha,
            asignado_por: jefe?.id_usuario ?? admin1.id_usuario
          });
        }
      }
    }
  }

  // ---- 11) FICHAJES de los 2 días anteriores para algunos trabajadores al azar ----
  const ayer    = new Date(`${hoy}T00:00:00`); ayer.setDate(ayer.getDate()-1);
  const antier  = new Date(`${hoy}T00:00:00`); antier.setDate(antier.getDate()-2);
  const fAy = ayer.toISOString().slice(0,10);
  const fAn = antier.toISOString().slice(0,10);

  // Cogemos 2 trabajadores por tienda y les generamos fichajes en un turno "Caja Mañana" si existe
  for(const t of tiendas){
    const workers = trabajadores.filter(w=>w.id_tienda===t.id_tienda).slice(0,2);
    const turnoCajaMan = turnosPorTienda.get(t.id_tienda).find(x=>x.etiqueta.includes('Caja'));
    if(!turnoCajaMan) continue;
    // Dos días, con ligeras variaciones de minutos
    for(const w of workers){
      const ent1 = `09:${String(randInt(0,9)).padStart(2,'0')}:00`;
      const sal1 = `13:${String(randInt(0,9)).padStart(2,'0')}:00`;
      const ent2 = `10:${String(randInt(0,9)).padStart(2,'0')}:00`;
      const sal2 = `14:${String(randInt(0,9)).padStart(2,'0')}:00`;
      await ensureFichaje({ id_trabajador:w.id_usuario, fecha:fAn, hora_entrada:ent1, hora_salida:sal1 });
      await ensureFichaje({ id_trabajador:w.id_usuario, fecha:fAy, hora_entrada:ent2, hora_salida:sal2 });
    }
  }

  // ---- 12) LOG resumen ----
  console.log('Seed OK (extendida). Resumen:',{
    tiendas: tiendas.map(t=>({id_tienda:t.id_tienda, nombre:t.nombre})),
    totalTrabajadores: trabajadores.length,
    admins: [admin1.id_usuario],
    tiposTurno: ['Caja','Reposición','Limpieza','Online'],
    turnosCodigo: turnosCodigo.map(c=>({
      id_turno_codigo:c.id_turno_codigo,
      codigo:c.codigo,
      horas:c.horas,
      descripcion:c.descripcion,
      creado:c.creado
    })),
    planificacionAsignaciones: {
      creadas: planificacionesCreadas,
      actualizadas: planificacionesActualizadas,
      muestra: planificacionEjemplo
    },
    ejemplo: {
      cualquierTienda: tiendas[0]?.id_tienda,
      cualquierTrabajador: trabajadores[0]?.id_usuario
    }
  });

}catch(err){
  console.error('Error seed extendida:', err);
  process.exitCode = 1;
}finally{
  await db.destroy();
}}
main();

