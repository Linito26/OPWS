/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TokenTipo" AS ENUM ('EMAIL_VERIFICACION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "apellido" TEXT,
ADD COLUMN     "email_verificado_en" TIMESTAMP(3),
ADD COLUMN     "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ultimo_inicio_en" TIMESTAMP(3),
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "dispositivos" (
    "id" SERIAL NOT NULL,
    "estacion_id" INTEGER NOT NULL,
    "dev_eui" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo_tipos" (
    "dispositivo_id" INTEGER NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "payload_key" TEXT NOT NULL,
    "canal" INTEGER,
    "escala" DOUBLE PRECISION DEFAULT 1.0,
    "offset" DOUBLE PRECISION DEFAULT 0.0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_tipos_pkey" PRIMARY KEY ("dispositivo_id","tipo_id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "tipo" "TokenTipo" NOT NULL,
    "token" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_dev_eui_key" ON "dispositivos"("dev_eui");

-- CreateIndex
CREATE INDEX "dispositivos_estacion_id_idx" ON "dispositivos"("estacion_id");

-- CreateIndex
CREATE INDEX "dispositivos_activo_idx" ON "dispositivos"("activo");

-- CreateIndex
CREATE INDEX "dispositivo_tipos_tipo_id_idx" ON "dispositivo_tipos"("tipo_id");

-- CreateIndex
CREATE INDEX "dispositivo_tipos_payload_key_idx" ON "dispositivo_tipos"("payload_key");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_tipos_dispositivo_id_payload_key_key" ON "dispositivo_tipos"("dispositivo_id", "payload_key");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_key" ON "tokens"("token");

-- CreateIndex
CREATE INDEX "tokens_usuario_id_idx" ON "tokens"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_estacion_id_fkey" FOREIGN KEY ("estacion_id") REFERENCES "estaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_tipos" ADD CONSTRAINT "dispositivo_tipos_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_tipos" ADD CONSTRAINT "dispositivo_tipos_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_medicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
