import { cookies } from "next/headers";
import { COOKIE_DEMO } from "@/data/demo-repo";
import { ExpedienteRepoProvider } from "@/features/expedientes/repo-context";
import { obtenerSesion } from "@/lib/sesion";

export default async function ExpedientesLayout({ children }: LayoutProps<"/expedientes">) {
  const [sesion, galletas] = await Promise.all([obtenerSesion(), cookies()]);
  // La demo vive en el navegador aunque haya sesión: nunca se mezcla con los datos de la cuenta.
  const demo = galletas.get(COOKIE_DEMO)?.value === "1";
  const modo = !demo && sesion?.session.activeOrganizationId ? "cuenta" : "invitado";
  // key: al iniciar o cerrar sesión, o al entrar o salir de la demo, cambia de implementación.
  return (
    <ExpedienteRepoProvider key={`${modo}-${demo}`} modo={modo} demo={demo}>
      {children}
    </ExpedienteRepoProvider>
  );
}
