// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedTiposMedicion() {
  const tipos = [
    { clave: "air_temp_c",       nombrePublico: "Temperatura del aire",   unidad: "°C", tipoAgregado: "promedio", descripcion: "Temperatura del aire medida por el sensor" },
    { clave: "air_humidity_pct", nombrePublico: "Humedad relativa",       unidad: "%",  tipoAgregado: "promedio", descripcion: "Humedad relativa del aire" },
    { clave: "soil_moisture_pct",nombrePublico: "Humedad del suelo",      unidad: "%",  tipoAgregado: "promedio", descripcion: "Contenido volumétrico aproximado de agua en el suelo" },
    { clave: "soil_temp_c",      nombrePublico: "Temperatura del suelo",  unidad: "°C", tipoAgregado: "promedio", descripcion: "Temperatura del suelo a profundidad del sensor" },
    { clave: "luminosity_lx",    nombrePublico: "Luminosidad",            unidad: "lx", tipoAgregado: "promedio", descripcion: "Iluminancia incidente" },
    { clave: "rainfall_mm",      nombrePublico: "Precipitación",          unidad: "mm", tipoAgregado: "suma",     descripcion: "Lluvia acumulada en el intervalo" },
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

async function seedEstacionDemo() {
  await prisma.estacion.upsert({
    where: { codigo: "EST-DEMO-01" },
    update: {
      nombre: "Estación Demo",
      zonaHoraria: "America/Guatemala",
      latitud: "15.700000",
      longitud: "-88.600000",
      elevacion_m: "20.00",
      notas: "Estación de ejemplo creada por el seed",
      activo: true,
    },
    create: {
      codigo: "EST-DEMO-01",
      nombre: "Estación Demo",
      zonaHoraria: "America/Guatemala",
      latitud: "15.700000",
      longitud: "-88.600000",
      elevacion_m: "20.00",
      notas: "Estación de ejemplo creada por el seed",
      activo: true,
    },
  });
  console.log("✓ Estacion: EST-DEMO-01 lista");
}

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

  // 2) Roles en ESPAÑOL
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

async function main() {
  await seedTiposMedicion();
  await seedEstacionDemo();
  await seedRolesPermisosYAdmin();
  console.log("Seed completo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
