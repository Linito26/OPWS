"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get("/devices", async (_req, res) => {
    const devices = await (0, db_1.db)().device.findMany({ orderBy: { id: "asc" } });
    res.json(devices);
});
exports.default = router;
