-- CreateTable
CREATE TABLE "opws"."estaciones" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "latitud" DECIMAL(9,6),
    "longitud" DECIMAL(9,6),
    "elevacion_m" DECIMAL(7,2),
    "zona_horaria" TEXT NOT NULL DEFAULT 'UTC',
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."tipos_medicion" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre_publico" TEXT,
    "unidad" TEXT NOT NULL,
    "tipo_agregado" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "tipos_medicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."mediciones" (
    "id" BIGSERIAL NOT NULL,
    "estacion_id" INTEGER NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "instante" TIMESTAMP(3) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "crudo" JSONB,
    "insertado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mediciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "rolId" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."permisos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opws"."usuario_permisos" (
    "usuario_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permisos_pkey" PRIMARY KEY ("usuario_id","permiso_id")
);

-- CreateTable
CREATE TABLE "opws"."rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estaciones_codigo_key" ON "opws"."estaciones"("codigo");

-- CreateIndex
CREATE INDEX "estaciones_activo_idx" ON "opws"."estaciones"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_medicion_clave_key" ON "opws"."tipos_medicion"("clave");

-- CreateIndex
CREATE INDEX "idx_med_est_tipo_ts" ON "opws"."mediciones"("estacion_id", "tipo_id", "instante");

-- CreateIndex
CREATE INDEX "idx_med_ts" ON "opws"."mediciones"("instante");

-- CreateIndex
CREATE UNIQUE INDEX "mediciones_estacion_id_tipo_id_instante_key" ON "opws"."mediciones"("estacion_id", "tipo_id", "instante");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "opws"."usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_activo_idx" ON "opws"."usuarios"("activo");

-- CreateIndex
CREATE INDEX "usuarios_rolId_idx" ON "opws"."usuarios"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "opws"."roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_nombre_key" ON "opws"."permisos"("nombre");

-- CreateIndex
CREATE INDEX "usuario_permisos_permiso_id_idx" ON "opws"."usuario_permisos"("permiso_id");

-- CreateIndex
CREATE INDEX "rol_permisos_permiso_id_idx" ON "opws"."rol_permisos"("permiso_id");

-- AddForeignKey
ALTER TABLE "opws"."mediciones" ADD CONSTRAINT "mediciones_estacion_id_fkey" FOREIGN KEY ("estacion_id") REFERENCES "opws"."estaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."mediciones" ADD CONSTRAINT "mediciones_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "opws"."tipos_medicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "opws"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."usuario_permisos" ADD CONSTRAINT "usuario_permisos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "opws"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."usuario_permisos" ADD CONSTRAINT "usuario_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "opws"."permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "opws"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opws"."rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "opws"."permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
