// Esquema de Postgres (Drizzle). Las tablas de cuentas y estudios las genera Better Auth en
// auth-schema.ts (estudio = organization, miembro = member). Las de expedientes están mapeadas
// 1:1 a schema/expediente.schema.json.
export * from "./auth-schema";
export * from "./expedientes-schema";
