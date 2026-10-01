import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/features/cuenta/formulario-ingreso";
import { obtenerSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

/** Solo rutas internas (evita redirecciones abiertas a otros sitios). */
function destinoSeguro(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/expedientes";
}

export default async function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const volver = destinoSeguro(params.volver);
  if (await obtenerSesion()) redirect(volver);
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 space-y-6 px-4 py-10 sm:py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresa a RutaObra</h1>
        <p className="text-muted-foreground text-sm">
          Tus expedientes quedan guardados en tu cuenta: los ves desde cualquier equipo y los
          compartes con tu estudio.
        </p>
      </div>
      <FormularioIngreso volver={volver} error={error} />
    </main>
  );
}
