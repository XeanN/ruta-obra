import { ExpedienteRepoProvider } from "@/features/expedientes/repo-context";
import { obtenerSesion } from "@/lib/sesion";

export default async function ExpedientesLayout({ children }: LayoutProps<"/expedientes">) {
  const sesion = await obtenerSesion();
  const modo = sesion?.session.activeOrganizationId ? "cuenta" : "invitado";
  // key: al iniciar o cerrar sesión cambia de implementación (servidor ↔ navegador).
  return (
    <ExpedienteRepoProvider key={modo} modo={modo}>
      {children}
    </ExpedienteRepoProvider>
  );
}
