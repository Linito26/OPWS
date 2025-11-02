"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const tipos = [
        { key: "air_temp_c", unit: "°C", description: "Temperatura del aire" },
        { key: "air_humidity_pct", unit: "%", description: "Humedad relativa" },
        { key: "soil_moisture_pct", unit: "%", description: "Humedad del suelo" },
        { key: "soil_temp_c", unit: "°C", description: "Temperatura del suelo" },
        { key: "luminosity_lx", unit: "lx", description: "Luminosidad" },
        { key: "rainfall_mm", unit: "mm", description: "Lluvia" }
    ];
    for (const t of tipos) {
        await prisma.measurementType.upsert({ where: { key: t.key }, update: {}, create: t });
    }
    console.log("Seed OK — MeasurementType listos");
}
main().catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
