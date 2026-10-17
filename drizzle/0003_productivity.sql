CREATE TABLE "daily_note" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"intention" text DEFAULT '' NOT NULL,
	"reflection" text DEFAULT '' NOT NULL,
	"capacity_minutes" integer,
	"planned_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_note_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text,
	"kind" text DEFAULT 'focus' NOT NULL,
	"planned_seconds" integer NOT NULL,
	"actual_seconds" integer NOT NULL,
	"completed" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'ink' NOT NULL,
	"target_per_week" smallint DEFAULT 7 NOT NULL,
	"sort_key" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_check" (
	"habit_id" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_check_habit_id_date_pk" PRIMARY KEY("habit_id","date")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "daily_note" ADD CONSTRAINT "daily_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_check" ADD CONSTRAINT "habit_check_habit_id_habit_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_session_user_id_started_at_index" ON "focus_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "habit_user_id_sort_key_index" ON "habit" USING btree ("user_id","sort_key");