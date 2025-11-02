"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get("/measurements", async (req, res) => {
    const { deviceId, type, from, to } = req.query;
    const where = {};
    if (deviceId)
        where.deviceId = Number(deviceId);
    if (type)
        where.type = { key: type };
    if (from || to)
        where.ts = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
    const rows = await (0, db_1.db)().measurement.findMany({ where, orderBy: { ts: "desc" }, take: 500 });
    res.json(rows);
});
exports.default = router;
