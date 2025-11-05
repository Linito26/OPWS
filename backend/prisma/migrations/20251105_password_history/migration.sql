-- CreateTable
CREATE TABLE "password_history" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_history_usuario_id_idx" ON "password_history"("usuario_id");

-- CreateIndex
CREATE INDEX "password_history_creado_en_idx" ON "password_history"("creado_en");

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
