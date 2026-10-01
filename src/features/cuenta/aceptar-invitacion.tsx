"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AceptarInvitacion({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4 text-sm">
      <p>
        Vas a unirte con <span className="font-medium">{email}</span>. Verás y editarás los
        expedientes de ese estudio.
      </p>
      {error && (
        <p role="alert" className="text-destructive font-medium">
          {error}
        </p>
      )}
      <Button
        size="lg"
        className="h-11 w-full"
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          setError(null);
          const r = await authClient.organization.acceptInvitation({ invitationId: id });
          if (r.error || !r.data) {
            setEnviando(false);
            setError(
              "No se pudo aceptar. Puede que la invitación haya vencido, ya se haya usado o sea para otro correo.",
            );
            return;
          }
          await authClient.organization.setActive({ organizationId: r.data.invitation.organizationId });
          toast.success("Te uniste al estudio");
          router.push("/expedientes");
          router.refresh();
        }}
      >
        Aceptar invitación
      </Button>
    </div>
  );
}
