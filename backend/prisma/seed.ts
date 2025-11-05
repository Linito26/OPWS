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
   2) ESTACIONES (múltiples)
   ========================= */
async function seedEstaciones() {
  const estaciones = [
    {
      codigo: "EST-01",
      nombre: "Estación Central",
      zonaHoraria: "America/Guatemala",
      latitud: "15.700000",
      longitud: "-88.600000",
      elevacion_m: "20.00",
      notas: "Estación principal en zona central",
      activo: true,
    },
    {
      codigo: "EST-02",
      nombre: "Estación Norte",
      zonaHoraria: "America/Guatemala",
      latitud: "15.750000",
      longitud: "-88.650000",
      elevacion_m: "35.00",
      notas: "Estación ubicada en zona norte",
      activo: true,
    },
    {
      codigo: "EST-03",
      nombre: "Estación Sur",
      zonaHoraria: "America/Guatemala",
      latitud: "15.650000",
      longitud: "-88.550000",
      elevacion_m: "15.00",
      notas: "Estación ubicada en zona sur",
      activo: true,
    },
  ];

  for (const est of estaciones) {
    await prisma.estacion.upsert({
      where: { codigo: est.codigo },
      update: { ...est },
      create: { ...est },
    });
  }

  console.log(`✓ Estaciones: ${estaciones.length} creadas/actualizadas`);
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

  // 5) Usuarios
  const usuarios = [
    {
      email: "admin@opws.test",
      password: "admin123",
      rolId: rolAdmin.id,
      nombre: "Administrador",
      apellido: "Sistema",
      username: "admin",
      mustChangePassword: false,
      activo: true,
    },
    {
      email: "viewer@opws.test",
      password: "viewer123",
      rolId: rolViewer.id,
      nombre: "Visualizador",
      apellido: "Demo",
      username: "viewer",
      mustChangePassword: false,
      activo: true,
    },
  ];

  for (const u of usuarios) {
    const passHash = await bcrypt.hash(u.password, 12);
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {
        password: passHash,
        rolId: u.rolId,
        nombre: u.nombre,
        apellido: u.apellido,
        username: u.username,
        activo: u.activo,
        mustChangePassword: u.mustChangePassword,
      },
      create: {
        email: u.email,
        password: passHash,
        rolId: u.rolId,
        nombre: u.nombre,
        apellido: u.apellido,
        username: u.username,
        activo: u.activo,
        mustChangePassword: u.mustChangePassword,
      },
    });
  }

  console.log("✓ Roles (ADMINISTRADOR / VISUALIZADOR) y usuarios listos");
  console.log("  - admin@opws.test / admin123");
  console.log("  - viewer@opws.test / viewer123");
}

/* =========================
   5) MEDICIONES DE EJEMPLO
   ========================= */
async function seedMedicionesEjemplo() {
  const estacion = await prisma.estacion.findUnique({ where: { codigo: "EST-01" } });
  if (!estacion) {
    console.log("⚠ No se encontró EST-01, saltando mediciones de ejemplo");
    return;
  }

  const tipos = await prisma.tipoMedicion.findMany();
  const tiposByClave = new Map(tipos.map(t => [t.clave, t]));

  // Generar datos para los últimos 7 días, cada hora
  const now = new Date();
  const mediciones: any[] = [];

  for (let d = 6; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const instante = new Date(now);
      instante.setDate(now.getDate() - d);
      instante.setHours(h, 0, 0, 0);

      // Temperatura aire (20-35°C, varía con hora del día)
      const tempBase = 25 + 8 * Math.sin(((h - 6) / 12) * Math.PI);
      mediciones.push({
        estacionId: estacion.id,
        tipoId: tiposByClave.get("air_temp_c")?.id,
        instante,
        valor: tempBase + (Math.random() - 0.5) * 2,
      });

      // Humedad relativa (60-90%)
      const humBase = 75 - 10 * Math.sin(((h - 6) / 12) * Math.PI);
      mediciones.push({
        estacionId: estacion.id,
        tipoId: tiposByClave.get("air_humidity_pct")?.id,
        instante,
        valor: Math.max(60, Math.min(90, humBase + (Math.random() - 0.5) * 5)),
      });

      // Humedad del suelo (40-70%)
      mediciones.push({
        estacionId: estacion.id,
        tipoId: tiposByClave.get("soil_moisture_pct")?.id,
        instante,
        valor: 55 + (Math.random() - 0.5) * 10,
      });

      // Luminosidad (0-60000 lx, solo día)
      const daylight = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      mediciones.push({
        estacionId: estacion.id,
        tipoId: tiposByClave.get("luminosity_lx")?.id,
        instante,
        valor: Math.round(60000 * daylight * (0.8 + Math.random() * 0.4)),
      });

      // Precipitación (0-5mm, aleatoria)
      mediciones.push({
        estacionId: estacion.id,
        tipoId: tiposByClave.get("rainfall_mm")?.id,
        instante,
        valor: Math.random() < 0.15 ? Math.random() * 5 : 0,
      });
    }
  }

  // Insertar en lotes para mejor rendimiento
  const batchSize = 100;
  for (let i = 0; i < mediciones.length; i += batchSize) {
    const batch = mediciones.slice(i, i + batchSize).filter(m => m.tipoId);
    await prisma.medicion.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  console.log(`✓ Mediciones de ejemplo: ${mediciones.length} insertadas para EST-01 (últimos 7 días)`);
}

/* =========================
   MAIN
   ========================= */
async function main() {
  await seedTiposMedicion();
  await seedEstaciones();
  await seedDispositivoYMapeos();
  await seedRolesPermisosYAdmin();
  await seedMedicionesEjemplo();
  console.log("\n✅ Seed completo.");
  console.log("\n📊 Resumen:");
  console.log("  • 3 Estaciones creadas");
  console.log("  • 2 Usuarios: admin@opws.test / viewer@opws.test");
  console.log("  • Mediciones de ejemplo para los últimos 7 días");
  console.log("  • Dispositivos TTN configurados");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
