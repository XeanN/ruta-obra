"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { claseSelect } from "@/features/checklist/checklist";
import { authClient } from "@/lib/auth-client";

const InvitarSchema = z.object({ email: z.email("Ingresa un correo válido") });

export function InvitarMiembro() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof InvitarSchema>>({ resolver: zodResolver(InvitarSchema) });

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={handleSubmit(async ({ email }) => {
        const r = await authClient.organization.inviteMember({ email, role: "member" });
        if (r.error) {
          toast.error(r.error.message ?? "No se pudo enviar la invitación.");
          return;
        }
        toast.success(`Invitación enviada a ${email}`);
        reset();
        router.refresh();
      })}
    >
      <label htmlFor="invitar-email" className="text-sm font-medium">
        Invitar a alguien de tu equipo
      </label>
      <div className="flex gap-2">
        <Input
          id="invitar-email"
          type="email"
          placeholder="correo@ejemplo.com"
          className="h-10"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "invitar-error" : undefined}
          {...register("email")}
        />
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          <UserPlus data-icon="inline-start" />
          Invitar
        </Button>
      </div>
      {errors.email && (
        <p id="invitar-error" role="alert" className="text-destructive text-xs font-medium">
          {errors.email.message}
        </p>
      )}
      <p className="text-muted-foreground text-xs">Le llegará un correo con un enlace válido por 7 días.</p>
    </form>
  );
}

export function Invitaciones({
  invitaciones,
  puedeCancelar,
}: {
  invitaciones: { id: string; email: string; vence: string }[];
  puedeCancelar: boolean;
}) {
  const router = useRouter();
  return (
    <section className="space-y-2 text-sm" aria-labelledby="invitaciones">
      <h2 id="invitaciones" className="font-medium">
        Invitaciones pendientes
      </h2>
      <ul className="space-y-1.5">
        {invitaciones.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {i.email} <span className="text-muted-foreground text-xs">· vence el {i.vence}</span>
            </span>
            {puedeCancelar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const r = await authClient.organization.cancelInvitation({ invitationId: i.id });
                  if (r.error) toast.error("No se pudo cancelar la invitación.");
                  else router.refresh();
                }}
              >
                <X data-icon="inline-start" />
                Cancelar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CambiarEstudio({ estudios, activo }: { estudios: { id: string; nombre: string }[]; activo: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tus estudios</CardTitle>
        <CardDescription>Elige con qué estudio trabajar. Cada uno tiene sus propios expedientes.</CardDescription>
      </CardHeader>
      <CardContent>
        <label htmlFor="estudio-activo" className="sr-only">
          Estudio activo
        </label>
        <select
          id="estudio-activo"
          className={claseSelect}
          defaultValue={activo}
          onChange={async (e) => {
            const r = await authClient.organization.setActive({ organizationId: e.target.value });
            if (r.error) toast.error("No se pudo cambiar de estudio.");
            else {
              toast.success("Estudio cambiado");
              router.refresh();
            }
          }}
        >
          {estudios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}

export function AccionesCuenta() {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button
        variant="outline"
        onClick={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        <LogOut data-icon="inline-start" />
        Cerrar sesión
      </Button>
      <Button variant="ghost" onClick={() => setConfirmar(true)}>
        <Trash2 data-icon="inline-start" />
        Eliminar mi cuenta
      </Button>
      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              Se borran tu cuenta y los estudios en los que eres la única persona, con todos sus
              expedientes y archivos. No se puede deshacer. Exporta antes los respaldos que quieras
              conservar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                const r = await authClient.deleteUser({ callbackURL: "/" });
                if (r.error) {
                  toast.error(r.error.message ?? "No se pudo eliminar la cuenta. Vuelve a ingresar e inténtalo.");
                  return;
                }
                toast.success("Cuenta eliminada");
                router.push("/");
                router.refresh();
              }}
            >
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
