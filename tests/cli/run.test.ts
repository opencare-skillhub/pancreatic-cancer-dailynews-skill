import { afterEach, describe, it, expect, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import { main, parseArgs } from '../../src/cli/index.js'

afterEach(async () => {
  await rm('data/reports', { recursive: true, force: true })
})

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

  it('runs digest generation and writes markdown report', async () => {
    const logs: string[] = []

    await main(['run', '--profile', 'daily-v5'], {
      collectItems: vi.fn().mockResolvedValue([
        {
          id: 'pmid:1',
          title: 'Demo paper',
          sourceType: 'pubmed',
          sectionHint: 'research_hotspots',
          sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/1/',
          fetchedAt: '2026-04-09T08:00:00.000Z',
          evidence: ['pmid:1'],
        },
      ]),
      log: (message) => logs.push(message),
    })

    expect(logs.join('\n')).toContain('Generated digest:')
    expect(logs.join('\n')).toContain('Demo paper')
  })
})
