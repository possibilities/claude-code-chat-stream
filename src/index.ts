import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import {
  existsSync,
  watch,
  readFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'fs'
import { homedir } from 'os'
import { join, dirname, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { ulid } from 'ulid'
import { entries } from './db/schema.js'
import { migrations } from './db/migrations.js'

function slugifyPath(absolutePath: string): string {
  return absolutePath.startsWith('/')
    ? `-${absolutePath.slice(1).replace(/[/.]/g, '-')}`
    : absolutePath.replace(/[/.]/g, '-')
}

function initializeDatabase(dbPath: string) {
  const absolutePath = resolve(dbPath)
  const dbDir = dirname(absolutePath)

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const sqlite = new Database(absolutePath)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')

  const db = drizzle(sqlite)

  if (
    !existsSync(absolutePath) ||
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'",
      )
      .get() === undefined
  ) {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER
      )
    `
    sqlite.prepare(createMigrationsTable).run()

    for (const [tag, sql] of Object.entries(migrations.migrations)) {
      const hash = tag
      const existing = sqlite
        .prepare('SELECT hash FROM __drizzle_migrations WHERE hash = ?')
        .get(hash)

      if (!existing) {
        sqlite.prepare(sql).run()
        sqlite
          .prepare(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          )
          .run(hash, Date.now())
      }
    }
  }

  return { db, sqlite }
}

async function main() {
  const program = new Command()

  program
    .name('claude-code-chat-stream')
    .description('CLI for Claude Code chat streaming')
    .version(packageJson.version)
    .argument('<database>', 'SQLite database path')
    .action(async (database: string) => {
      const processStartTime = Date.now()
      const currentDirectory = process.cwd()
      const slugifiedName = slugifyPath(currentDirectory)
      const claudeProjectsPath = join(homedir(), '.claude', 'projects')
      const projectPath = join(claudeProjectsPath, slugifiedName)

      const { db, sqlite } = initializeDatabase(database)

      console.error(`Database: ${resolve(database)}`)

      const fileWatchers = new Map<string, ReturnType<typeof watch>>()
      const linesPrintedPerFile = new Map<string, number>()

      let projectWatcher: ReturnType<typeof watch> | null = null

      const startWatchingProject = () => {
        console.error(`Found project: ${projectPath}`)
        console.error('Watching for new files...')

        projectWatcher = watch(
          projectPath,
          { recursive: false },
          (eventType, filename) => {
            if (
              eventType === 'rename' &&
              filename &&
              filename.endsWith('.jsonl')
            ) {
              console.error(`New file detected: ${filename}`)

              const filePath = join(projectPath, filename)
              setupFileWatching(filePath, filename)
            }
          },
        )

        try {
          const files = readdirSync(projectPath)
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const filePath = join(projectPath, file)
              const stats = statSync(filePath)
              if (stats.mtimeMs >= processStartTime) {
                console.error(`Processing existing file: ${file}`)
                setupFileWatching(filePath, file)
              }
            }
          }
        } catch (error) {}
      }

      const setupFileWatching = (filePath: string, filename: string) => {
        if (fileWatchers.has(filename)) return

        const processFile = async () => {
          try {
            const content = readFileSync(filePath, 'utf-8')
            const lines = content.split('\n').filter(line => line.trim())
            const lastPrinted = linesPrintedPerFile.get(filename) || 0

            for (let i = lastPrinted; i < lines.length; i++) {
              const jsonLine = lines[i]
              console.log(jsonLine)

              const id = ulid()
              const maxRetries = 5
              let retryCount = 0
              let success = false

              while (retryCount < maxRetries && !success) {
                try {
                  sqlite.prepare('BEGIN IMMEDIATE').run()

                  await db.insert(entries).values({
                    id,
                    data: jsonLine,
                    cwd: currentDirectory,
                    filepath: filePath,
                    created: new Date(),
                  })

                  sqlite.prepare('COMMIT').run()
                  success = true
                } catch (error: any) {
                  sqlite.prepare('ROLLBACK').run()

                  if (
                    error.code === 'SQLITE_BUSY' &&
                    retryCount < maxRetries - 1
                  ) {
                    retryCount++
                    const waitTime = Math.min(
                      100 * Math.pow(2, retryCount),
                      1000,
                    )
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                  } else {
                    console.error(`Failed to store line: ${error.message}`)
                    break
                  }
                }
              }
            }

            linesPrintedPerFile.set(filename, lines.length)
          } catch (error) {}
        }

        processFile()

        const fileWatcher = watch(filePath, eventType => {
          if (eventType === 'change') {
            processFile()
          }
        })

        fileWatchers.set(filename, fileWatcher)
      }

      if (existsSync(projectPath)) {
        startWatchingProject()
      } else {
        console.error(`Waiting for project directory: ${projectPath}`)

        const projectsDirWatcher = watch(
          claudeProjectsPath,
          (eventType, filename) => {
            if (eventType === 'rename' && filename === slugifiedName) {
              if (existsSync(projectPath)) {
                console.error(`Project directory created: ${projectPath}`)
                projectsDirWatcher.close()
                startWatchingProject()
              }
            }
          },
        )
      }

      process.on('SIGINT', () => {
        console.error('\nStopping watchers...')
        if (projectWatcher) projectWatcher.close()
        fileWatchers.forEach(fw => fw.close())
        sqlite.close()
        process.exit(0)
      })
    })

  try {
    program.exitOverride()
    program.configureOutput({
      writeErr: str => process.stderr.write(str),
    })

    await program.parseAsync(process.argv)
  } catch (error: any) {
    if (
      error.code === 'commander.help' ||
      error.code === 'commander.helpDisplayed'
    ) {
      process.exit(0)
    }
    console.error('Error:', error.message || error)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
