import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AceptarInvitacion } from "@/features/cuenta/aceptar-invitacion";
import { obtenerSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Invitación · RutaObra" };

export default async function InvitacionPage({ params }: PageProps<"/invitacion/[id]">) {
  const { id } = await params;
  const sesion = await obtenerSesion();
  return (
    <main className="mx-auto w-full max-w-sm flex-1 space-y-6 px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Invitación a un estudio</h1>
      {sesion ? (
        <AceptarInvitacion id={id} email={sesion.user.email} />
      ) : (
        <div className="space-y-4 text-sm">
          <p>Para unirte al estudio, ingresa con el correo al que llegó la invitación.</p>
          <Link
            href={`/ingresar?volver=${encodeURIComponent(`/invitacion/${id}`)}`}
            className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
          >
            Ingresar para aceptar
          </Link>
        </div>
      )}
    </main>
  );
}
