CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`source_url` text,
	`storage_key` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
