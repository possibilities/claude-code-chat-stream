CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`cwd` text NOT NULL,
	`filepath` text NOT NULL,
	`created` integer DEFAULT (unixepoch()) NOT NULL
);
