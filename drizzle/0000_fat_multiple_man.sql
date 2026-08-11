CREATE TABLE `lectures` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`title` text NOT NULL,
	`transcript` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL
);
