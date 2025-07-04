import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, watch, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

function slugifyPath(absolutePath: string): string {
  return absolutePath.startsWith('/')
    ? `-${absolutePath.slice(1).replace(/[/.]/g, '-')}`
    : absolutePath.replace(/[/.]/g, '-')
}

async function main() {
  const program = new Command()

  program
    .name('claude-chat-stream')
    .description('CLI for Claude Code chat streaming')
    .version(packageJson.version)
    .action(() => {
      const currentDirectory = process.cwd()
      const slugifiedName = slugifyPath(currentDirectory)
      const claudeProjectsPath = join(homedir(), '.claude', 'projects')
      const projectPath = join(claudeProjectsPath, slugifiedName)

      if (!existsSync(projectPath)) {
        console.error(
          `Error: No corresponding Claude project found for ${currentDirectory}`,
        )
        console.error(`Expected path: ${projectPath}`)
        process.exit(1)
      }

      console.error(`Found project: ${projectPath}`)
      console.error('Watching for new files...')

      let linesPrinted = 0
      let fileWatcher: ReturnType<typeof watch> | null = null

      const watcher = watch(
        projectPath,
        { recursive: false },
        (eventType, filename) => {
          if (
            eventType === 'rename' &&
            filename &&
            filename.endsWith('.jsonl')
          ) {
            console.error(`New file detected: ${filename}`)
            watcher.close()

            const filePath = join(projectPath, filename)

            const processFile = () => {
              try {
                const content = readFileSync(filePath, 'utf-8')
                const lines = content.split('\n').filter(line => line.trim())

                for (let i = linesPrinted; i < lines.length; i++) {
                  console.log(lines[i])
                }

                linesPrinted = lines.length
              } catch (error) {}
            }

            processFile()

            fileWatcher = watch(filePath, eventType => {
              if (eventType === 'change') {
                processFile()
              }
            })
          }
        },
      )

      process.on('SIGINT', () => {
        console.error('\nStopping watchers...')
        watcher.close()
        if (fileWatcher) fileWatcher.close()
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
