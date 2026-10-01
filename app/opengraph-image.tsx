import { ImageResponse } from "next/og";

// Imagen para compartir (WhatsApp, LinkedIn, Facebook). Se genera en el build.
export const alt = "RutaObra: todos tus expedientes de obra, de SUNARP a la conformidad, en un solo lugar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ETAPAS = ["Saneamiento", "Licencia", "Obra", "Conformidad"];

export default function Imagen() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#18181b",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#fbbf24" }}>RutaObra</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            Todos tus expedientes de obra, de SUNARP a la conformidad, en un solo lugar
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
            Qué trámite sigue, cuánto cuesta por distrito y avisos antes de que algo venza.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26 }}>
          {ETAPAS.map((e, i) => (
            <div key={e} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "2px solid #3f3f46",
                  color: i === ETAPAS.length - 1 ? "#18181b" : "#e4e4e7",
                  background: i === ETAPAS.length - 1 ? "#fbbf24" : "transparent",
                }}
              >
                {e}
              </div>
              {i < ETAPAS.length - 1 && <div style={{ display: "flex", color: "#71717a" }}>→</div>}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
