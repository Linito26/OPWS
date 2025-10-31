"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get("/health", async (_req, res) => {
    await (0, db_1.db)().$queryRaw `SELECT 1`;
    res.json({ ok: true, service: "OPWS API" });
});
exports.default = router;
