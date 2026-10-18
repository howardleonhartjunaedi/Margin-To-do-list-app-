ALTER TABLE "user_settings" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ai_enabled" boolean DEFAULT false NOT NULL;