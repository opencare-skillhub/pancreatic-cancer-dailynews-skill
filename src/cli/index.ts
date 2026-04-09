import { pathToFileURL } from 'node:url'

export type ParsedArgs = {
  command: string
  profile?: string
}

export function parseArgs(argv: string[]): ParsedArgs {
  let command: string | undefined
  let profile: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--profile') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('--profile requires a value')
      }
      profile = value
      index += 1
      continue
    }

    if (current.startsWith('--')) {
      continue
    }

    if (!command) {
      command = current
    }
  }

  return {
    command: command ?? 'run',
    profile,
  }
}

export function main(argv = process.argv.slice(2)): void {
  parseArgs(argv)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
