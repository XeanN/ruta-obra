// Aplica las migraciones de drizzle/ con node-postgres (TCP), sin WebSocket: funciona igual en
// local, en CI y en el build de Vercel. Usa DATABASE_URL_UNPOOLED (conexión directa, sin pooler).
//   node scripts/migrar.mjs            -> aplica las pendientes
// En Vercel corre dentro de `pnpm vercel-build`, antes de `next build`.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("migrar: falta DATABASE_URL_UNPOOLED (o DATABASE_URL).");
  process.exit(1);
}

const host = new URL(url).hostname.split(".")[0];
const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
try {
  await cliente.connect();
  await migrate(drizzle(cliente), { migrationsFolder: "drizzle" });
  const { rows } = await cliente.query("select count(*)::int as n from drizzle.__drizzle_migrations");
  console.log(`migrar: OK en ${host} (${rows[0].n} migraciones aplicadas en total).`);
} catch (e) {
  console.error(`migrar: falló en ${host}:`, e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}
