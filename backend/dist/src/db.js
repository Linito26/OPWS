"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = db;
const client_1 = __importDefault(require("@prisma/client"));
const { PrismaClient } = client_1.default;
let prisma;
function db() {
    if (!prisma)
        prisma = new PrismaClient();
    return prisma;
}
