-- CreateTable
CREATE TABLE "public"."Device" (
    "id" SERIAL NOT NULL,
    "devEui" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MeasurementType" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "MeasurementType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Measurement" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "raw" JSONB,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawUplink" (
    "id" SERIAL NOT NULL,
    "devEui" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "RawUplink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_devEui_key" ON "public"."Device"("devEui");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementType_key_key" ON "public"."MeasurementType"("key");

-- CreateIndex
CREATE INDEX "Measurement_deviceId_ts_idx" ON "public"."Measurement"("deviceId", "ts");

-- CreateIndex
CREATE INDEX "Measurement_typeId_ts_idx" ON "public"."Measurement"("typeId", "ts");

-- AddForeignKey
ALTER TABLE "public"."Measurement" ADD CONSTRAINT "Measurement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Measurement" ADD CONSTRAINT "Measurement_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."MeasurementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
