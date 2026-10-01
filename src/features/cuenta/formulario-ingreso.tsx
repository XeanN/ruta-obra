"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const CorreoSchema = z.object({ email: z.email("Ingresa un correo válido") });

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.9 10.9 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function FormularioIngreso({ volver, error }: { volver: string; error?: string }) {
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(
    error ? "No pudimos completar el ingreso. Inténtalo de nuevo." : null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof CorreoSchema>>({ resolver: zodResolver(CorreoSchema) });

  if (enviadoA) {
    return (
      <div role="status" className="bg-muted/50 space-y-2 rounded-lg border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <MailCheck aria-hidden className="size-4" /> Revisa tu correo
        </p>
        <p>
          Enviamos un enlace a <span className="font-medium">{enviadoA}</span>. Vence en 15 minutos y
          sirve una sola vez. Si no lo ves, revisa la carpeta de spam.
        </p>
        <Button variant="link" className="px-0" onClick={() => setEnviadoA(null)}>
          Usar otro correo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {problema && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {problema}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full"
        onClick={async () => {
          setProblema(null);
          const r = await authClient.signIn.social({ provider: "google", callbackURL: volver, errorCallbackURL: "/ingresar?error=google" });
          if (r.error) setProblema("No se pudo ingresar con Google. Inténtalo de nuevo.");
        }}
      >
        <GoogleLogo />
        Continuar con Google
      </Button>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> o con tu correo <span className="bg-border h-px flex-1" />
      </div>

      <form
        noValidate
        className="space-y-3"
        onSubmit={handleSubmit(async ({ email }) => {
          setProblema(null);
          const r = await authClient.signIn.magicLink({ email, callbackURL: volver, errorCallbackURL: "/ingresar?error=enlace" });
          if (r.error) setProblema("No pudimos enviar el enlace. Revisa el correo e inténtalo de nuevo.");
          else setEnviadoA(email);
        })}
      >
        <div className="space-y-1.5">
          <label htmlFor="ingreso-email" className="text-sm font-medium">
            Correo
          </label>
          <Input
            id="ingreso-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="h-11"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "ingreso-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="ingreso-email-error" role="alert" className="text-destructive text-xs font-medium">
              {errors.email.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
          Enviarme un enlace para ingresar
        </Button>
      </form>

      <p className="text-muted-foreground text-xs">
        Al continuar aceptas la{" "}
        <Link href="/privacidad" className="underline underline-offset-2">
          política de privacidad
        </Link>
        . Sin contraseñas: ingresas con Google o con un enlace a tu correo.
      </p>
    </div>
  );
}
