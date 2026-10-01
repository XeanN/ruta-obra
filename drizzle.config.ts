import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// En local lee .env.local; en Vercel (vercel-build) las variables ya vienen del entorno.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/data/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
