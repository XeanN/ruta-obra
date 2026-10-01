CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actores" (
	"expediente_id" text NOT NULL,
	"id" text NOT NULL,
	"orden" integer NOT NULL,
	"rol" text NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"colegiatura" text,
	CONSTRAINT "actores_expediente_id_id_pk" PRIMARY KEY("expediente_id","id")
);
--> statement-breakpoint
CREATE TABLE "archivos" (
	"id" text PRIMARY KEY NOT NULL,
	"estudio_id" text NOT NULL,
	"expediente_id" text NOT NULL,
	"clave" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"tamano" integer NOT NULL,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "archivos_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "documentos_cargados" (
	"expediente_id" text NOT NULL,
	"id" text NOT NULL,
	"orden" integer NOT NULL,
	"documento_id" text NOT NULL,
	"estado" text NOT NULL,
	"fecha_emision" date,
	"fecha_vencimiento" date,
	"archivo_url" text,
	"notas" text,
	CONSTRAINT "documentos_cargados_expediente_id_id_pk" PRIMARY KEY("expediente_id","id")
);
--> statement-breakpoint
CREATE TABLE "entradas_bitacora" (
	"expediente_id" text NOT NULL,
	"id" text NOT NULL,
	"orden" integer NOT NULL,
	"fecha" date NOT NULL,
	"tipo" text NOT NULL,
	"descripcion" text NOT NULL,
	"monto" double precision,
	"avance_pct" double precision,
	"actor_id" text,
	"fotos" jsonb,
	CONSTRAINT "entradas_bitacora_expediente_id_id_pk" PRIMARY KEY("expediente_id","id")
);
--> statement-breakpoint
CREATE TABLE "expedientes" (
	"id" text PRIMARY KEY NOT NULL,
	"estudio_id" text NOT NULL,
	"predio_id" text NOT NULL,
	"nombre" text NOT NULL,
	"respuestas_diagnostico" jsonb NOT NULL,
	"modalidad" text,
	"version_datos" text,
	"creado_por" text,
	"creado_en" text NOT NULL,
	"actualizado_en" text,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pasos" (
	"expediente_id" text NOT NULL,
	"orden" integer NOT NULL,
	"procedimiento_id" text NOT NULL,
	"etapa_id" text NOT NULL,
	"estado" text NOT NULL,
	"numero_expediente_entidad" text,
	"fecha_presentacion" date,
	"fecha_resultado" date,
	"fecha_observacion" date,
	"monto_pagado" double precision,
	"responsable_id" text,
	"notas" text,
	CONSTRAINT "pasos_expediente_id_procedimiento_id_pk" PRIMARY KEY("expediente_id","procedimiento_id")
);
--> statement-breakpoint
CREATE TABLE "predios" (
	"id" text PRIMARY KEY NOT NULL,
	"estudio_id" text NOT NULL,
	"ubigeo" text NOT NULL,
	"direccion" text NOT NULL,
	"partida_registral" text,
	"area_terreno_m2" double precision,
	"lat" double precision,
	"lng" double precision,
	"zonas_especiales" jsonb
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actores" ADD CONSTRAINT "actores_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_estudio_id_organization_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_cargados" ADD CONSTRAINT "documentos_cargados_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_bitacora" ADD CONSTRAINT "entradas_bitacora_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_estudio_id_organization_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_predio_id_predios_id_fk" FOREIGN KEY ("predio_id") REFERENCES "public"."predios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pasos" ADD CONSTRAINT "pasos_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predios" ADD CONSTRAINT "predios_estudio_id_organization_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "archivos_expediente_idx" ON "archivos" USING btree ("expediente_id");--> statement-breakpoint
CREATE INDEX "expedientes_estudio_idx" ON "expedientes" USING btree ("estudio_id");--> statement-breakpoint
CREATE INDEX "predios_estudio_idx" ON "predios" USING btree ("estudio_id");