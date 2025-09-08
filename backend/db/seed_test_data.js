const db=require('./connection');
async function getPwdCol(){try{const i=await db('Usuarios').columnInfo();for(const c of ['contrasena_hash','contrase\u00f1a_hash','password']){if(i[c])return c;}}catch(_){}return null}
async function upsertUser({nombre,email,password,rol}){const e=await db('Usuarios').where({email}).first();if(e)return{ id_usuario:e.id_usuario||e.id||e.ID};const r={nombre,email,rol};const col=await getPwdCol();if(col)r[col]=(typeof password==='string'?password:'');const [id_usuario]=await db('Usuarios').insert(r);return{ id_usuario}}
async function ensureStore({nombre,direccion,id_jefe=null}){let t=await db('Tiendas').where({nombre}).first();if(t)return t;const [id_tienda]=await db('Tiendas').insert({nombre,direccion,id_jefe});return{ id_tienda,nombre,direccion,id_jefe}}
async function setStoreManager(id_tienda,id_jefe){await db('Tiendas').where({id_tienda}).update({id_jefe})}
async function ensureWorkerInStore(id_usuario,id_tienda){const ex=await db('Trabajadores').where({id_trabajador:id_usuario}).first();if(ex)return;const hoy=new Date().toISOString().slice(0,10);await db('Trabajadores').insert({id_trabajador:id_usuario,id_tienda,fecha_alta:hoy})}
async function ensureTipoTurno(nombre){const r=await db('TiposTurno').where({nombre}).first();if(r)return r.id_tipo_turno||r.id||r.ID;const [id]=await db('TiposTurno').insert({nombre});return id}
async function ensureTurno({id_tienda,id_tipo_turno=null,hora_inicio,hora_fin}){let q=db('Turnos').where({id_tienda,hora_inicio,hora_fin});if(id_tipo_turno)q=q.andWhere({id_tipo_turno});const e=await q.first();if(e)return e.id_turno||e.id||e.ID;const [id]=await db('Turnos').insert({id_tienda,id_tipo_turno,hora_inicio,hora_fin});return id}
function mondayOfWeek(s){const d=new Date(`${s}T00:00:00`);const g=d.getDay();const diff=(g===0?-6:1-g);d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10)}
function weekDates(a){const r=[];const s=new Date(`${a}T00:00:00`);for(let i=0;i<7;i++){const d=new Date(s);d.setDate(d.getDate()+i);r.push(d.toISOString().slice(0,10))}return r}
async function upsertReq({id_turno,fecha,cantidad}){const e=await db('RequerimientosTurno').where({id_turno,fecha}).first();if(e){await db('RequerimientosTurno').where({id_turno,fecha}).update({cantidad})}else{await db('RequerimientosTurno').insert({id_turno,fecha,cantidad})}}
async function ensureAsig({id_trabajador,id_turno,fecha,asignado_por=null}){const e=await db('AsignacionesTurno').where({id_trabajador,id_turno,fecha}).first();if(e)return e.id_asignacion||e.id||e.ID;const [id]=await db('AsignacionesTurno').insert({id_trabajador,id_turno,fecha,asignado_por});return id}
async function ensureFichaje({id_trabajador,fecha,hora_entrada=null,hora_salida=null,fuente='fichaje'}){const e=await db('Fichajes').where({id_trabajador,fecha}).first();if(e){const p={};if(hora_entrada&&!e.hora_entrada)p.hora_entrada=hora_entrada;if(hora_salida&&!e.hora_salida)p.hora_salida=hora_salida;if(Object.keys(p).length)await db('Fichajes').where({id_fichaje:e.id_fichaje}).update(p);return e.id_fichaje||e.id||e.ID}const [id]=await db('Fichajes').insert({id_trabajador,fecha,hora_entrada,hora_salida,fuente});return id}
async function main(){try{
  const tN=await ensureStore({nombre:'Tienda Norte',direccion:'Calle Norte 1'});const tS=await ensureStore({nombre:'Tienda Sur',direccion:'Avenida Sur 2'});
  const idTN=tN.id_tienda||tN.ID||tN.id;const idTS=tS.id_tienda||tS.ID||tS.id;
  const a1=await upsertUser({nombre:'Admin Uno',email:'admin1@example.com',password:'Admin1234',rol:'administrador'});
  await upsertUser({nombre:'Admin Dos',email:'admin2@example.com',password:'Admin1234',rol:'administrador'});
  const j1=await upsertUser({nombre:'Jefe Norte',email:'jefe1@example.com',password:'Jefe1234',rol:'jefe'});
  const j2=await upsertUser({nombre:'Jefe Sur',email:'jefe2@example.com',password:'Jefe1234',rol:'jefe'});
  await setStoreManager(idTN,j1.id_usuario);await setStoreManager(idTS,j2.id_usuario);
  const w1=await upsertUser({nombre:'Trabajador Norte',email:'trab1@example.com',password:null,rol:'trabajador'});
  const w2=await upsertUser({nombre:'Trabajador Sur',email:'trab2@example.com',password:null,rol:'trabajador'});
  await ensureWorkerInStore(w1.id_usuario,idTN);await ensureWorkerInStore(w2.id_usuario,idTS);
  const tipoCaja=await ensureTipoTurno('Caja');const tipoRepo=await ensureTipoTurno('Reposici\u00f3n');
  const tNM=await ensureTurno({id_tienda:idTN,id_tipo_turno:tipoCaja,hora_inicio:'09:00',hora_fin:'13:00'});
  const tNT=await ensureTurno({id_tienda:idTN,id_tipo_turno:tipoRepo,hora_inicio:'16:00',hora_fin:'20:00'});
  const tSM=await ensureTurno({id_tienda:idTS,id_tipo_turno:tipoCaja,hora_inicio:'10:00',hora_fin:'14:00'});
  const tST=await ensureTurno({id_tienda:idTS,id_tipo_turno:tipoRepo,hora_inicio:'15:00',hora_fin:'19:00'});
  const hoy=new Date().toISOString().slice(0,10);const lunes=mondayOfWeek(hoy);const fechas=weekDates(lunes);
  for(const f of fechas){await upsertReq({id_turno:tNM,fecha:f,cantidad:1});await upsertReq({id_turno:tNT,fecha:f,cantidad:1});await upsertReq({id_turno:tSM,fecha:f,cantidad:1});await upsertReq({id_turno:tST,fecha:f,cantidad:2});}
  await ensureAsig({id_trabajador:w1.id_usuario,id_turno:tNM,fecha:fechas[0],asignado_por:j1.id_usuario});
  await ensureAsig({id_trabajador:w1.id_usuario,id_turno:tNM,fecha:fechas[2],asignado_por:j1.id_usuario});
  await ensureAsig({id_trabajador:w2.id_usuario,id_turno:tSM,fecha:fechas[1],asignado_por:j2.id_usuario});
  await ensureAsig({id_trabajador:w2.id_usuario,id_turno:tSM,fecha:fechas[3],asignado_por:j2.id_usuario});
  const ayer=new Date(`${hoy}T00:00:00`);ayer.setDate(ayer.getDate()-1);const antier=new Date(`${hoy}T00:00:00`);antier.setDate(antier.getDate()-2);const fAy=ayer.toISOString().slice(0,10);const fAn=antier.toISOString().slice(0,10);
  await ensureFichaje({id_trabajador:w1.id_usuario,fecha:fAn,hora_entrada:'09:05:00',hora_salida:'13:02:00'});
  await ensureFichaje({id_trabajador:w1.id_usuario,fecha:fAy,hora_entrada:'16:02:00',hora_salida:'19:58:00'});
  await ensureFichaje({id_trabajador:w2.id_usuario,fecha:fAn,hora_entrada:'10:10:00',hora_salida:'13:55:00'});
  await ensureFichaje({id_trabajador:w2.id_usuario,fecha:fAy,hora_entrada:'15:00:00',hora_salida:'19:00:00'});
  console.log('Seed OK. Ejemplos:',{tiendaNorte:idTN,tiendaSur:idTS,admin:a1.id_usuario,turnoNorteManana:tNM});
}catch(err){console.error('Error seed:',err);process.exitCode=1}finally{await db.destroy()}}
main();
