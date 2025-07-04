import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

function slugifyPath(absolutePath: string): string {
  return absolutePath.startsWith('/')
    ? `-${absolutePath.slice(1).replace(/[/.]/g, '-')}`
    : absolutePath.replace(/[/.]/g, '-')
}

function countFilesRecursively(dirPath: string): number {
  let fileCount = 0
  const entries = readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      fileCount += countFilesRecursively(fullPath)
    } else if (entry.isFile()) {
      fileCount++
    }
  }

  return fileCount
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

      const fileCount = countFilesRecursively(projectPath)
      console.log(`Found project: ${slugifiedName}`)
      console.log(`Number of files: ${fileCount}`)
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
