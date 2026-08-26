CREATE TYPE "public"."ai_engine" AS ENUM('chatgpt', 'claude', 'gemini', 'perplexity', 'google_aio');--> statement-breakpoint
CREATE TYPE "public"."category_intent" AS ENUM('traffic', 'money', 'both');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('draft', 'review', 'published', 'merged', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('running', 'ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lang" AS ENUM('mk', 'sq', 'en');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'sold', 'closed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."match_decision" AS ENUM('pending', 'merged', 'rejected', 'auto_merged');--> statement-breakpoint
CREATE TYPE "public"."place_kind" AS ENUM('region', 'opstina', 'grad', 'naselba');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('central_registry', 'osm', 'google_places', 'facebook', 'instagram', 'website', 'phone_verification', 'manual', 'owner');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'verified', 'featured', 'ai_visibility');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"engine" "ai_engine" NOT NULL,
	"model" text,
	"raw_answer" text NOT NULL,
	"cited_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_mk" text NOT NULL,
	"name_sq" text,
	"kind" text DEFAULT 'bool' NOT NULL,
	"options" text[],
	"category_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name_mk" text NOT NULL,
	"name_sq" text,
	"schema_type" text DEFAULT 'LocalBusiness' NOT NULL,
	"nkd_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"intent" "category_intent" DEFAULT 'traffic' NOT NULL,
	"is_pilot" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"status" "entity_status" DEFAULT 'draft' NOT NULL,
	"name_mk" text NOT NULL,
	"name_sq" text,
	"name_lat" text NOT NULL,
	"name_norm" text NOT NULL,
	"legal_name" text,
	"embs" text,
	"edb" text,
	"place_id" uuid,
	"address" text,
	"address_norm" text,
	"lat" double precision,
	"lng" double precision,
	"phone_e164" text,
	"phone_alt" text[] DEFAULT '{}'::text[] NOT NULL,
	"email" text,
	"website" text,
	"website_host" text,
	"facebook" text,
	"instagram" text,
	"description_mk" text,
	"description_sq" text,
	"price_level" smallint,
	"summary_mk" text,
	"rating_external" real,
	"review_count_external" integer,
	"rating_source" text,
	"rating_checked_at" timestamp with time zone,
	"claimed_by" uuid,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"score" real,
	"score_computed_at" timestamp with time zone,
	"merged_into" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_attribute" (
	"entity_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" text DEFAULT 'true' NOT NULL,
	"source_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "entity_attribute_entity_id_attribute_id_pk" PRIMARY KEY("entity_id","attribute_id")
);
--> statement-breakpoint
CREATE TABLE "entity_category" (
	"entity_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "entity_category_entity_id_category_id_pk" PRIMARY KEY("entity_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "entity_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"value_json" jsonb,
	"source_id" uuid NOT NULL,
	"source_record_id" uuid,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price_from" numeric(10, 2),
	"price_to" numeric(10, 2),
	"currency" text DEFAULT 'MKD' NOT NULL,
	"unit" text,
	"note" text,
	"source_id" uuid,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"place_id" uuid,
	"contact_name" text,
	"contact_phone" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"price_eur" numeric(10, 2),
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"modifier" text,
	"language" "lang" DEFAULT 'mk' NOT NULL,
	"title_mk" text NOT NULL,
	"is_indexable" boolean DEFAULT false NOT NULL,
	"gate_reason" text,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_idx" UNIQUE NULLS NOT DISTINCT("place_id","category_id","modifier","language")
);
--> statement-breakpoint
CREATE TABLE "list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score_snapshot" real,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"sponsored_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"left_entity_id" uuid NOT NULL,
	"right_entity_id" uuid NOT NULL,
	"pair_key" text NOT NULL,
	"score" real NOT NULL,
	"features" jsonb NOT NULL,
	"decision" "match_decision" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"credit" text,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mention" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer_id" uuid NOT NULL,
	"entity_id" uuid,
	"raw_name" text NOT NULL,
	"position" integer,
	"sentiment" text,
	"cited_us" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens" text,
	"closes" text,
	"closed" boolean DEFAULT false NOT NULL,
	"exception_date" date,
	"source_id" uuid,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "place" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "place_kind" NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name_mk" text NOT NULL,
	"name_sq" text,
	"name_lat" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"population" integer,
	"is_pilot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"language" "lang" DEFAULT 'mk' NOT NULL,
	"place_id" uuid,
	"category_id" uuid,
	"intent" text DEFAULT 'discovery' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"author_name" text,
	"rating" smallint NOT NULL,
	"body" text,
	"language" "lang" DEFAULT 'mk' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"total" real NOT NULL,
	"components" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_mk" text NOT NULL,
	"name_sq" text,
	"unit" text DEFAULT 'per_visit' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "source_kind" NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trust" smallint DEFAULT 50 NOT NULL,
	"licence" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"entity_id" uuid,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"period" text DEFAULT 'yearly' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"price_eur" numeric(10, 2),
	"invoice_ref" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"renews_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "answer_snapshot" ADD CONSTRAINT "answer_snapshot_query_id_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."query"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_claimed_by_account_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_merged_into_entity_id_fk" FOREIGN KEY ("merged_into") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_attribute" ADD CONSTRAINT "entity_attribute_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_attribute" ADD CONSTRAINT "entity_attribute_attribute_id_attribute_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_attribute" ADD CONSTRAINT "entity_attribute_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_category" ADD CONSTRAINT "entity_category_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_category" ADD CONSTRAINT "entity_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_field" ADD CONSTRAINT "entity_field_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_field" ADD CONSTRAINT "entity_field_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_field" ADD CONSTRAINT "entity_field_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_service" ADD CONSTRAINT "entity_service_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_service" ADD CONSTRAINT "entity_service_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_service" ADD CONSTRAINT "entity_service_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_delivery" ADD CONSTRAINT "lead_delivery_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_delivery" ADD CONSTRAINT "lead_delivery_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidate" ADD CONSTRAINT "match_candidate_left_entity_id_entity_id_fk" FOREIGN KEY ("left_entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidate" ADD CONSTRAINT "match_candidate_right_entity_id_entity_id_fk" FOREIGN KEY ("right_entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_answer_id_answer_snapshot_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answer_snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place" ADD CONSTRAINT "place_parent_id_place_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."place"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query" ADD CONSTRAINT "query_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query" ADD CONSTRAINT "query_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_run" ADD CONSTRAINT "score_run_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_idx" ON "account" USING btree ("email");--> statement-breakpoint
CREATE INDEX "answer_snapshot_query_idx" ON "answer_snapshot" USING btree ("query_id","engine","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_slug_idx" ON "attribute" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "category_slug_idx" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "category_parent_idx" ON "category" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_slug_idx" ON "entity" USING btree ("slug") WHERE "entity"."slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_embs_idx" ON "entity" USING btree ("embs") WHERE "entity"."embs" is not null;--> statement-breakpoint
CREATE INDEX "entity_status_idx" ON "entity" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entity_place_idx" ON "entity" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "entity_phone_idx" ON "entity" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "entity_name_norm_trgm_idx" ON "entity" USING gin ("name_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "entity_category_category_idx" ON "entity_category" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_unique_idx" ON "entity_field" USING btree ("entity_id","key","source_id");--> statement-breakpoint
CREATE INDEX "entity_field_lookup_idx" ON "entity_field" USING btree ("entity_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_service_idx" ON "entity_service" USING btree ("entity_id","service_id");--> statement-breakpoint
CREATE INDEX "job_run_kind_idx" ON "job_run" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "lead_category_idx" ON "lead" USING btree ("category_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_delivery_idx" ON "lead_delivery" USING btree ("lead_id","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "list_item_idx" ON "list_item" USING btree ("list_id","entity_id");--> statement-breakpoint
CREATE INDEX "list_item_rank_idx" ON "list_item" USING btree ("list_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "match_candidate_pair_idx" ON "match_candidate" USING btree ("pair_key");--> statement-breakpoint
CREATE INDEX "match_candidate_pending_idx" ON "match_candidate" USING btree ("score") WHERE "match_candidate"."decision" = 'pending';--> statement-breakpoint
CREATE INDEX "media_entity_idx" ON "media" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "mention_answer_idx" ON "mention" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "mention_entity_idx" ON "mention" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "opening_hours_entity_idx" ON "opening_hours" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_slug_idx" ON "place" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "place_parent_idx" ON "place" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "query_text_idx" ON "query" USING btree ("text","language");--> statement-breakpoint
CREATE INDEX "review_entity_idx" ON "review" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "score_run_entity_idx" ON "score_run" USING btree ("entity_id","computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_slug_idx" ON "service" USING btree ("category_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "source_kind_name_idx" ON "source" USING btree ("kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "source_record_external_idx" ON "source_record" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "source_record_unprocessed_idx" ON "source_record" USING btree ("processed_at") WHERE "source_record"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "source_record_entity_idx" ON "source_record" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "subscription_entity_idx" ON "subscription" USING btree ("entity_id");