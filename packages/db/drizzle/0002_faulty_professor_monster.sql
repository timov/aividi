CREATE TYPE "public"."article_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"place_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"author_id" uuid,
	"language" "lang" DEFAULT 'mk' NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"intro" text,
	"outro" text,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_slug_unique" UNIQUE("slug"),
	CONSTRAINT "article_scope_idx" UNIQUE("place_id","category_id","language")
);
--> statement-breakpoint
CREATE TABLE "article_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"role" text,
	"verdict" text,
	"pick" text,
	"warning" text,
	CONSTRAINT "article_entry_idx" UNIQUE("article_id","entity_id"),
	CONSTRAINT "article_role_idx" UNIQUE NULLS NOT DISTINCT("article_id","role")
);
--> statement-breakpoint
CREATE TABLE "article_faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"bio" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_id_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."author"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_entry" ADD CONSTRAINT "article_entry_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_entry" ADD CONSTRAINT "article_entry_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_faq" ADD CONSTRAINT "article_faq_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_status_idx" ON "article" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "article_entry_rank_idx" ON "article_entry" USING btree ("article_id","rank");--> statement-breakpoint
CREATE INDEX "article_faq_idx" ON "article_faq" USING btree ("article_id","sort");