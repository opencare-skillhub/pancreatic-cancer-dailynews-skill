import { describe, expect, it } from 'vitest'
import { loadSourcesRegistry } from '../../src/config/load_sources_registry.js'
import { parseSimpleYaml } from '../../src/config/simple_yaml.js'

describe('sources registry yaml', () => {
  it('parses simple yaml structures', () => {
    const parsed = parseSimpleYaml(`
sources:
  - id: demo
    enabled: true
    tags:
      - one
      - two
    nested:
      command: npx
      args: ["-y", "demo"]
`)

    expect((parsed as { sources: Array<{ id: string; nested: { args: string[] } }> }).sources[0]?.id).toBe('demo')
    expect((parsed as { sources: Array<{ nested: { args: string[] } }> }).sources[0]?.nested.args).toEqual(['-y', 'demo'])
  })

  it('loads the project sources registry from yaml', async () => {
    const registry = await loadSourcesRegistry()
    expect(registry.sources.some((entry) => entry.id === 'clinical_trials_mcp')).toBe(true)
    expect(registry.sources.some((entry) => entry.id === 'openclaw_grok_search')).toBe(true)
  })
})
