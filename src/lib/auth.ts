import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { eliminarObjetos } from "@/data/archivos";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import { enviarCorreo, plantilla } from "./correo";

/** URL pública: la configurada, o la del despliegue de Vercel (vistas previas), o local. */
function urlBase(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const origenes = [
  urlBase(),
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
  "http://localhost:3000",
].filter((x): x is string => Boolean(x));

/** Primer estudio del usuario (el personal o al que lo invitaron). */
async function estudioInicial(usuarioId: string): Promise<string | null> {
  const fila = await db.query.member.findFirst({
    where: eq(schema.member.userId, usuarioId),
    columns: { organizationId: true },
  });
  return fila?.organizationId ?? null;
}

export const auth = betterAuth({
  appName: "RutaObra",
  baseURL: urlBase(),
  trustedOrigins: origenes,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    deleteUser: {
      enabled: true,
      // Ley 29733: eliminar la cuenta borra los estudios donde la persona es la única integrante,
      // con sus expedientes (en cascada) y sus archivos en R2.
      beforeDelete: async (usuario) => {
        const membresias = await db
          .select({ estudioId: schema.member.organizationId })
          .from(schema.member)
          .where(eq(schema.member.userId, usuario.id));
        for (const { estudioId } of membresias) {
          const integrantes = await db
            .select({ id: schema.member.id })
            .from(schema.member)
            .where(eq(schema.member.organizationId, estudioId));
          if (integrantes.length > 1) continue;
          const claves = (
            await db.select({ clave: schema.archivos.clave }).from(schema.archivos).where(eq(schema.archivos.estudioId, estudioId))
          ).map((f) => f.clave);
          await eliminarObjetos(claves);
          await db.delete(schema.organization).where(eq(schema.organization.id, estudioId));
        }
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Cada usuario nuevo tiene su estudio personal y es su dueño.
        after: async (usuario) => {
          const estudioId = crypto.randomUUID();
          const nombre = usuario.name?.trim() ? `Estudio de ${usuario.name.trim()}` : "Mi estudio";
          await db.insert(schema.organization).values({
            id: estudioId,
            name: nombre,
            slug: `estudio-${estudioId.slice(0, 8)}`,
            createdAt: new Date(),
          });
          await db.insert(schema.member).values({
            id: crypto.randomUUID(),
            organizationId: estudioId,
            userId: usuario.id,
            role: "owner",
            createdAt: new Date(),
          });
        },
      },
    },
    session: {
      create: {
        // Toda sesión arranca con un estudio activo: es lo que filtra los expedientes.
        before: async (sesion) => {
          const estudioId = await estudioInicial(sesion.userId);
          return { data: { ...sesion, activeOrganizationId: estudioId } };
        },
      },
    },
  },
  plugins: [
    organization({
      // Los estudios se crean solos al registrarse; las personas se suman por invitación.
      allowUserToCreateOrganization: false,
      invitationExpiresIn: 7 * 24 * 60 * 60,
      sendInvitationEmail: async (data) => {
        const url = `${urlBase()}/invitacion/${data.id}`;
        const { html, texto } = plantilla(
          `Te invitaron a ${data.organization.name}`,
          `${data.inviter.user.name || data.inviter.user.email} te invitó a trabajar en sus expedientes de obra en RutaObra.`,
          "Aceptar invitación",
          url,
        );
        await enviarCorreo(data.email, `Invitación a ${data.organization.name} en RutaObra`, html, texto);
      },
    }),
    magicLink({
      expiresIn: 15 * 60,
      sendMagicLink: async ({ email, url }) => {
        const { html, texto } = plantilla(
          "Tu enlace para ingresar",
          "Usa este botón para ingresar a RutaObra. Vence en 15 minutos y sirve una sola vez.",
          "Ingresar a RutaObra",
          url,
        );
        await enviarCorreo(email, "Tu enlace para ingresar a RutaObra", html, texto);
      },
    }),
    nextCookies(),
  ],
});

export type Sesion = typeof auth.$Infer.Session;
