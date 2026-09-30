# PRD — RutaObra (prototipo de validación)

> Nombre de trabajo. Versión 0.1 · 30-09-2026 · Autor: Angel Ponce

## 1. Problema

En Perú, construir o regularizar una edificación privada exige recorrer 7 etapas repartidas entre SUNARP, notarías, municipalidad distrital, Municipalidad de Lima, autoridades sectoriales (PROHVILLA, SERNANP, Ministerio de Cultura), empresas de servicios y el Ministerio de Trabajo. Ninguna entidad ni herramienta privada conecta el recorrido completo. Hoy el propietario o el profesional:

- no sabe qué sigue ni en qué orden;
- se entera tarde de requisitos que dependen de la ubicación (p. ej. la opinión de PROHVILLA), cuando la municipalidad observa el expediente;
- pierde documentos por vencimiento (la copia literal vale 30 días; la licencia, 36 meses);
- lleva la obra (maestro, obreros, pagos, avance) en WhatsApp y cuadernos.

No existe una API pública del Estado para presentar trámites ni consultar su estado (la PIDE es solo para entidades públicas). La oportunidad es **orquestar con datos propios**, no automatizar el envío.

## 2. Usuarios

| Segmento | Qué necesita | Prioridad |
|---|---|---|
| **Profesional gestor** (arquitecto, ingeniero, consultora de saneamiento) con 5–30 expedientes | Ver en qué va cada caso, qué falta, qué vence, sin rehacer la investigación por distrito | **Principal: quien paga** |
| **Propietario / familia** que construye una vez | Entender su ruta, cuánto cuesta y cuánto demora | Secundario (captación vía SEO, freemium) |
| **Pequeña inmobiliaria / constructora** | Multi-expediente + bitácora de obra | Futuro |

## 3. Objetivo del prototipo

Validar con 5–10 profesionales de Lima Sur si:

1. el diagnóstico y la hoja de ruta les ahorran tiempo real;
2. el seguimiento multi-expediente reemplaza su método actual;
3. pagarían y cuánto (por expediente o suscripción).

**No es objetivo:** backend productivo, pagos, presentación electrónica de trámites.

## 4. Alcance funcional (MVP del prototipo)

### F1. Diagnóstico del predio
- Asistente paso a paso con las preguntas de `data/diagnostico_preguntas.json` (preguntas condicionales con `mostrar_si`).
- Resultado inmediato: modalidad estimada (A/B/C/D), alertas y programas aplicables.

### F2. Hoja de ruta personalizada
- Lista de procedimientos agrupados por etapa (E1–E7), en orden, generada por el motor de reglas (`data/reglas.json`).
- Cada paso muestra: entidad, requisitos (documentos), plazo, costo del distrito (`tarifas_distritales.json`) o referencial, profesionales que firman, **fuente con enlace** y **estado de verificación** (etiqueta visible si no está `verificado`).
- Pasos opcionales y alternativas (p. ej. "Revisores Urbanos en vez de municipalidad").
- Resumen: costo estatal estimado (suma de lo conocido y cuántos montos faltan) y tiempo estimado.

### F3. Checklist de documentos
- Unión de los requisitos de todos los pasos, sin duplicados, con quién lo emite y su vigencia.
- Estados: falta / en trámite / obtenido / vencido. Fecha de emisión → calcula vencimiento.

### F4. Alertas de vencimiento
- Según `data/vencimientos.json` (copia literal 30 días, parámetros 36 meses, licencia 36 meses + prórroga, subsanación 5 días hábiles).
- Panel de alertas por expediente y global. Días hábiles excluyen fines de semana (feriados: fase 2).

### F5. Seguimiento multi-expediente
- Crear expediente = diagnóstico + datos del predio + actores.
- Tablero de todos los expedientes: etapa actual, % de avance, próximo paso, próximas alertas.
- Por paso: estado (pendiente → en preparación → presentado → observado → subsanado → aprobado), número de trámite en la entidad, fechas y monto pagado.

### F6. Bitácora de obra
- Entradas fechadas: avance, compra, pago, visita municipal, reunión, incidencia, cambio de obra; monto, % avance, responsable y fotos (en el prototipo: URL o archivo local).
- Vista cronológica y totales de gasto.

### F7. Fuentes y transparencia
- Página "Cómo sabemos esto": fuentes, fecha de corte y estados de verificación. Aviso legal visible.

## 5. Requisitos no funcionales

- **Móvil primero**: se mostrará en el celular a arquitectos en obra.
- **Sin backend en el prototipo**: datos de conocimiento en JSON estático; datos de usuario en `localStorage` detrás de un repositorio intercambiable.
- **Trazabilidad**: todo dato mostrado conoce su `fuente_id` y su `estado_verificacion`.
- **Idioma**: español (Perú); moneda PEN; fechas `dd/mm/aaaa`.
- **Accesibilidad**: contraste AA, formularios con etiquetas y navegación por teclado.

## 6. Métricas de la validación

| Métrica | Umbral para seguir |
|---|---|
| Profesionales entrevistados | ≥ 8 |
| Dicen que el diagnóstico les ahorra ≥ 1 h por caso | ≥ 5 de 8 |
| Cargarían sus expedientes reales en la herramienta | ≥ 4 |
| Aceptan un precio concreto (compromiso: prueba pagada o carta de intención) | ≥ 3 |

Detalle en `docs/validacion.md`.

## 7. Fases posteriores (fuera del prototipo)

1. Backend (Postgres/Supabase), autenticación, multiusuario por estudio.
2. Extracción asistida por IA de TUPAs (PDF → `tarifas_distritales.json`) con revisión humana.
3. Mapa: cruce de coordenadas del predio con polígonos de zonas especiales.
4. Páginas SEO por distrito × trámite, generadas desde el JSON.
5. Más distritos; convenio municipal (vía PIDE) a largo plazo.
