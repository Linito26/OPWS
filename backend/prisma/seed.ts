// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* =========================
   1) TIPOS DE MEDICIÓN
   ========================= */
async function seedTiposMedicion() {
  const tipos = [
    { clave: "air_temp_c",         nombrePublico: "Temperatura del aire",   unidad: "°C", tipoAgregado: "promedio", descripcion: "Temperatura del aire medida por el sensor" },
    { clave: "air_humidity_pct",   nombrePublico: "Humedad relativa",       unidad: "%",  tipoAgregado: "promedio", descripcion: "Humedad relativa del aire" },
    { clave: "soil_moisture_pct",  nombrePublico: "Humedad del suelo",      unidad: "%",  tipoAgregado: "promedio", descripcion: "Contenido volumétrico aproximado de agua en el suelo" },
    { clave: "soil_temp_c",        nombrePublico: "Temperatura del suelo",  unidad: "°C", tipoAgregado: "promedio", descripcion: "Temperatura del suelo a profundidad del sensor" },
    { clave: "luminosity_lx",      nombrePublico: "Luminosidad",            unidad: "lx", tipoAgregado: "promedio", descripcion: "Iluminancia incidente" },
    { clave: "rainfall_mm",        nombrePublico: "Precipitación",          unidad: "mm", tipoAgregado: "suma",     descripcion: "Lluvia acumulada en el intervalo" },
  ];

  for (const t of tipos) {
    await prisma.tipoMedicion.upsert({
      where: { clave: t.clave },
      update: {
        nombrePublico: t.nombrePublico,
        unidad: t.unidad,
        tipoAgregado: t.tipoAgregado,
        descripcion: t.descripcion,
      },
      create: t,
    });
  }
  console.log("✓ TipoMedicion: sembrados/actualizados");
}

/* =========================
   2) ESTACIÓN DEMO (única)
   ========================= */
async function seedEstacionDemo() {
  const codigo = "EST-01";
  await prisma.estacion.upsert({
    where: { codigo },
    update: {
      nombre: "Estación 1",
      zonaHoraria: "America/Guatemala",
      latitud: "15.700000",
      longitud: "-88.600000",
      elevacion_m: "20.00",
      notas: "Estación de ejemplo creada por el seed",
      activo: true,
    },
    create: {
      codigo,
      nombre: "Estación 1",
      zonaHoraria: "America/Guatemala",
      latitud: "15.700000",
      longitud: "-88.600000",
      elevacion_m: "20.00",
      notas: "Estación de ejemplo creada por el seed",
      activo: true,
    },
  });
  console.log(`✓ Estacion: ${codigo} lista`);
}

/* ======================================================
   3) DISPOSITIVO TTN + MAPEO payload_key → tipo_medicion
   ====================================================== */
async function seedDispositivoYMapeos() {
  // Busca la estación creada
  const estacion = await prisma.estacion.findUnique({ where: { codigo: "EST-01" } });
  if (!estacion) throw new Error("No se encontró la estación EST-01");

  // Dispositivo TTN (ajusta el devEui si lo necesitas)
  const devEui = "AABBCCDDEEFF0011";
  const dispositivo = await prisma.dispositivo.upsert({
    where: { devEui },
    update: { estacionId: estacion.id, activo: true, descripcion: "Nodo multi-sensor (simulado/TTN)" },
    create: { devEui, estacionId: estacion.id, activo: true, descripcion: "Nodo multi-sensor (simulado/TTN)" },
  });

  // Mapeo de payload_key -> TipoMedicion (usa TUS claves)
  const claves = [
    "air_temp_c",
    "air_humidity_pct",
    "soil_moisture_pct",
    "soil_temp_c",
    "luminosity_lx",
    "rainfall_mm",
  ];

  const tipos = await prisma.tipoMedicion.findMany({ where: { clave: { in: claves } } });
  const tiposByClave = new Map(tipos.map(t => [t.clave, t]));

  for (const clave of claves) {
    const tipo = tiposByClave.get(clave);
    if (!tipo) continue;
    await prisma.dispositivoTipo.upsert({
      where: { dispositivoId_tipoId: { dispositivoId: dispositivo.id, tipoId: tipo.id } },
      update: { payloadKey: clave, escala: 1.0, offset: 0.0 },
      create: { dispositivoId: dispositivo.id, tipoId: tipo.id, payloadKey: clave, escala: 1.0, offset: 0.0 },
    });
  }

  console.log("✓ Dispositivo TTN y mapeos payload_key creados:", { devEui, estacion: "EST-01" });
}

/* =========================================
   4) ROLES, PERMISOS Y USUARIO ADMIN DEMO
   ========================================= */
async function seedRolesPermisosYAdmin() {
  // 1) Permisos base
  const permisosBase = [
    "VER_SENSORES",
    "VER_SERIES",
    "GESTIONAR_ESTACIONES",
    "GESTIONAR_USUARIOS",
  ];
  for (const nombre of permisosBase) {
    await prisma.permiso.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  const perms = await prisma.permiso.findMany({
    where: { nombre: { in: permisosBase } },
    select: { id: true, nombre: true },
  });

  // 2) Roles (en español)
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: "ADMINISTRADOR" },
    update: {},
    create: { nombre: "ADMINISTRADOR" },
  });
  const rolViewer = await prisma.rol.upsert({
    where: { nombre: "VISUALIZADOR" },
    update: {},
    create: { nombre: "VISUALIZADOR" },
  });

  // 3) Permisos para ADMINISTRADOR (todos)
  await prisma.rolPermiso.createMany({
    data: perms.map((p) => ({ rolId: rolAdmin.id, permisoId: p.id })),
    skipDuplicates: true,
  });

  // 4) Permisos para VISUALIZADOR (solo lectura)
  const soloLectura = perms.filter(p => ["VER_SENSORES","VER_SERIES"].includes(p.nombre));
  await prisma.rolPermiso.createMany({
    data: soloLectura.map((p) => ({ rolId: rolViewer.id, permisoId: p.id })),
    skipDuplicates: true,
  });

  // 5) Usuario admin
  const email = "admin@opws.test";
  const passHash = await bcrypt.hash("admin123", 12);

  await prisma.usuario.upsert({
    where: { email },
    update: { password: passHash, rolId: rolAdmin.id, nombre: "Admin", activo: true, mustChangePassword: false },
    create: { email, password: passHash, rolId: rolAdmin.id, nombre: "Admin", activo: true, mustChangePassword: false },
  });

  console.log("✓ Roles (ADMINISTRADOR / VISUALIZADOR) y usuario admin listos");
}

/* =========================
   MAIN
   ========================= */
async function main() {
  await seedTiposMedicion();
  await seedEstacionDemo();
  await seedDispositivoYMapeos();
  await seedRolesPermisosYAdmin();
  console.log("Seed completo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
