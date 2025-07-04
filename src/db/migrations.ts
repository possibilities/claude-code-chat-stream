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
\t\`created\` integer DEFAULT (unixepoch()) NOT NULL
);`,
  },
}
