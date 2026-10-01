import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Pool por WebSocket: permite transacciones (el repositorio guarda un expediente con sus pasos,
// documentos y actores de una sola vez). Node 22+ trae WebSocket global.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export type BaseDeDatos = typeof db;
