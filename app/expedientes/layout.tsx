import { ExpedienteRepoProvider } from "@/features/expedientes/repo-context";

export default function ExpedientesLayout({ children }: LayoutProps<"/expedientes">) {
  return <ExpedienteRepoProvider>{children}</ExpedienteRepoProvider>;
}
