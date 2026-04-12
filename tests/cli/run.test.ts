import { describe, it, expect, vi } from 'vitest'
import { main, parseArgs } from '../../src/cli/index.js'

describe('cli parseArgs', () => {
  it('defaults to run with no arguments', () => {
    const result = parseArgs([])
    expect(result.command).toBe('run')
    expect(result.profile).toBeUndefined()
  })

  it('parses profile before command', () => {
    const result = parseArgs(['--profile', 'daily-v5', 'run'])
    expect(result.command).toBe('run')
    expect(result.profile).toBe('daily-v5')
  })

  it('supports xiaoyibao command flags', () => {
    const result = parseArgs(['xiaoyibao', '--skills', '--fix'])
    expect(result.command).toBe('xiaoyibao')
    expect(result.skillsOnly).toBe(true)
    expect(result.fix).toBe(true)
  })

  it('keeps doctor as backward-compatible alias', () => {
    const result = parseArgs(['doctor', '--skills'])
    expect(result.command).toBe('xiaoyibao')
    expect(result.skillsOnly).toBe(true)
  })

  it('supports install-source target', () => {
    const result = parseArgs(['install-source', 'pubmed_mcp'])
    expect(result.command).toBe('install-source')
    expect(result.installSource).toBe('pubmed_mcp')
  })

  it('supports sync-sources command', () => {
    const result = parseArgs(['sync-sources'])
    expect(result.command).toBe('sync-sources')
  })

  it('supports yes flag', () => {
    const result = parseArgs(['xiaoyibao', '--fix', '--yes'])
    expect(result.yes).toBe(true)
  })

  it('throws when profile is missing a value', () => {
    expect(() => parseArgs(['run', '--profile'])).toThrow('--profile requires a value')
  })

  it('runs xiaoyibao fix installs after confirmation', async () => {
    const logs: string[] = []
    const confirm = vi.fn().mockResolvedValue(true)
    const runInstallCommand = vi.fn().mockImplementation(async (command: string) => ({
      id: command,
      command,
      success: true,
      exitCode: 0,
    }))

    await main(['xiaoyibao', '--fix', '--skills'], {
      confirm,
      runInstallCommand,
      ensureConfigTemplate: vi.fn().mockResolvedValue('Created config file from template: .env.test.local'),
      log: (message) => logs.push(message),
    })

    expect(confirm).toHaveBeenCalled()
    expect(runInstallCommand).toHaveBeenCalled()
    expect(logs.join('\n')).toContain('Install queue:')
    expect(logs.join('\n')).toContain('Install results:')
    expect(logs.join('\n')).toContain('Config file actions:')
  })
})
