"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function MenuUsuario() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="inline-block w-5" aria-hidden />;
  if (!data) {
    return (
      <Link href="/ingresar" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        {/* En el celular solo el ícono: el encabezado no entra a 375 px con texto. */}
        <CircleUserRound aria-hidden className="size-5 sm:hidden" />
        <span className="sr-only sm:not-sr-only">Ingresar</span>
      </Link>
    );
  }
  return (
    <Link href="/cuenta" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <CircleUserRound aria-hidden className="size-5" />
      <span className="sr-only">Mi cuenta ({data.user.name || data.user.email})</span>
    </Link>
  );
}
