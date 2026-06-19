"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const drizzle_kit_1 = require("drizzle-kit");
const url = process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5544/football_gm';
exports.default = (0, drizzle_kit_1.defineConfig)({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url },
});
//# sourceMappingURL=drizzle.config.js.map