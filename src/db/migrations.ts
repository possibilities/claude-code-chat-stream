export const migrations = {
  journal: {
    version: '7',
    dialect: 'sqlite',
    entries: [
      {
        idx: 0,
        version: '6',
        when: 1751644173778,
        tag: '0000_funny_speedball',
        breakpoints: true,
      },
    ],
  },
  migrations: {
    '0000_funny_speedball': `CREATE TABLE \`entries\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`data\` text NOT NULL,
\t\`cwd\` text NOT NULL,
\t\`filepath\` text NOT NULL,
\t\`created\` integer DEFAULT (unixepoch()) NOT NULL,
\t\`session_id\` text GENERATED ALWAYS AS (json_extract(data, '$.sessionId')) STORED
);

CREATE INDEX idx_entries_cwd ON entries(cwd);
CREATE INDEX idx_entries_created ON entries(created);
CREATE INDEX idx_entries_filepath ON entries(filepath);
CREATE INDEX idx_entries_cwd_created ON entries(cwd, created);
CREATE INDEX idx_entries_session_id ON entries(session_id);
CREATE INDEX idx_entries_cwd_session_id ON entries(cwd, session_id);
CREATE INDEX idx_entries_cwd_session_created ON entries(cwd, session_id, created);`,
  },
}
