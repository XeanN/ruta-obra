// Configuración mínima para `pnpm auth:generate` (la CLI de Better Auth no puede cargar
// src/lib/auth.ts porque usa "server-only"). Mantener los MISMOS plugins que src/lib/auth.ts.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: "pg" }),
  plugins: [organization(), magicLink({ sendMagicLink: async () => {} })],
});
