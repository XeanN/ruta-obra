import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccionesCuenta, CambiarEstudio, Invitaciones, InvitarMiembro } from "@/features/cuenta/acciones-cuenta";
import { auth } from "@/lib/auth";
import { obtenerSesion } from "@/lib/sesion";
import { formatFecha } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

const ROL: Record<string, string> = { owner: "Dueño", admin: "Administrador", member: "Miembro" };

export default async function CuentaPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar?volver=/cuenta");
  const h = await headers();
  const [estudio, estudios] = await Promise.all([
    auth.api.getFullOrganization({ headers: h }),
    auth.api.listOrganizations({ headers: h }),
  ]);
  const yo = estudio?.members.find((m) => m.userId === sesion.user.id);
  const puedeInvitar = yo?.role === "owner" || yo?.role === "admin";
  const pendientes = (estudio?.invitations ?? []).filter((i) => i.status === "pending");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-muted-foreground text-sm">
          {sesion.user.name} · {sesion.user.email}
        </p>
      </div>

      {estudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{estudio.name}</CardTitle>
            <CardDescription>
              Todos los miembros del estudio ven y editan los mismos expedientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="divide-y text-sm">
              {estudio.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.user.name || m.user.email}</p>
                    <p className="text-muted-foreground truncate text-xs">{m.user.email}</p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">{ROL[m.role] ?? m.role}</span>
                </li>
              ))}
            </ul>
            {puedeInvitar && <InvitarMiembro />}
            {pendientes.length > 0 && (
              <Invitaciones
                invitaciones={pendientes.map((i) => ({
                  id: i.id,
                  email: i.email,
                  vence: formatFecha(new Date(i.expiresAt).toISOString().slice(0, 10)),
                }))}
                puedeCancelar={puedeInvitar}
              />
            )}
          </CardContent>
        </Card>
      )}

      {estudios.length > 1 && (
        <CambiarEstudio
          estudios={estudios.map((e) => ({ id: e.id, nombre: e.name }))}
          activo={sesion.session.activeOrganizationId ?? ""}
        />
      )}

      <AccionesCuenta />
    </main>
  );
}
