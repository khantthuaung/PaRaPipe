CREATE TABLE `subjects` (
	`name` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `lectures` ADD `audio_key` text;