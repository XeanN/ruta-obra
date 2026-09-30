import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">RutaObra</h1>
      <p className="text-muted-foreground text-lg">
        Tus trámites de construcción, de SUNARP a la conformidad de obra, en un
        solo lugar.
      </p>
      <div>
        <Button nativeButton={false} render={<Link href="/diagnostico" />}>
          Diagnosticar mi predio
        </Button>
      </div>
    </main>
  );
}
