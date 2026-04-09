import { describe, it, expect } from 'vitest'
import { parseArgs } from '../../src/cli/index'

describe('cli parseArgs', () => {
  it('parses run command with profile', () => {
    const result = parseArgs(['run', '--profile', 'daily-v5'])
    expect(result.command).toBe('run')
    expect(result.profile).toBe('daily-v5')
  })
})
