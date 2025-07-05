CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`cwd` text NOT NULL,
	`filepath` text NOT NULL,
	`created` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX idx_entries_cwd ON entries(cwd);
CREATE INDEX idx_entries_created ON entries(created);
CREATE INDEX idx_entries_filepath ON entries(filepath);
CREATE INDEX idx_entries_cwd_created ON entries(cwd, created);
CREATE INDEX idx_entries_session_id ON entries(json_extract(data, '$.sessionId'));
