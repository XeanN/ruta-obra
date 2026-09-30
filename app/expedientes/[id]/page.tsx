export default async function ExpedientePage({
  params,
}: PageProps<"/expedientes/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Expediente {id}</h1>
      <p className="text-muted-foreground mt-2">Próximamente (Fase 4).</p>
    </main>
  );
}
