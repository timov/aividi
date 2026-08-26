ALTER TABLE "entity" ADD COLUMN "karma" real;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "karma_reviews" integer;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "karma_confidence" text;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "karma_components" jsonb;