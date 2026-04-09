export type ParsedArgs = {
  command: string
  profile?: string
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] ?? 'run'
  const profileIndex = argv.indexOf('--profile')
  const profile = profileIndex >= 0 ? argv[profileIndex + 1] : undefined

  return {
    command,
    profile,
  }
}
