"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const health_1 = __importDefault(require("./routes/health"));
const devices_1 = __importDefault(require("./routes/devices"));
const measurements_1 = __importDefault(require("./routes/measurements"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.use("/api", health_1.default);
app.use("/api", devices_1.default);
app.use("/api", measurements_1.default);
const PORT = Number(process.env.PORT || 2002);
app.listen(PORT, () => console.log(`OPWS API en http://localhost:${PORT}`));
