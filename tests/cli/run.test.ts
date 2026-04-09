import { describe, it, expect } from 'vitest'
import { parseArgs } from '../../src/cli/index.js'

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

  it('throws when profile is missing a value', () => {
    expect(() => parseArgs(['run', '--profile'])).toThrow('--profile requires a value')
  })
})
