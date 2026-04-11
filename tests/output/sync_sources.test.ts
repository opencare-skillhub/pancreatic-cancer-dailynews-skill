import { describe, expect, it } from 'vitest'
import {
  buildDependencyCatalog,
  buildEnvExampleContent,
  buildReadmeGeneratedBlock,
} from '../../src/output/sync_sources.js'
import { sourceRegistrySchema } from '../../src/schema/source_registry.js'

const registry = sourceRegistrySchema.parse({
  sources: [
    {
      id: 'demo_skill',
      type: 'skill',
      required: false,
      enabled: true,
      role: 'demo',
      check: { kind: 'command', command: 'node --version' },
      install: { kind: 'github_skill', command: 'npx skills add demo' },
      config: {
        file: '.env.demo.local',
        vars: ['DEMO_API_KEY'],
        exampleValues: { DEMO_API_KEY: 'replace-demo-key' },
      },
      mcp: {
        command: 'npx',
        args: ['-y', 'demo-mcp'],
      },
    },
  ],
})

describe('sync sources', () => {
  it('builds dependency catalog from registry', () => {
    const catalog = buildDependencyCatalog(registry)
    expect(catalog.demo_skill?.metadata?.configPath).toBe('.env.demo.local')
    expect(catalog.demo_skill?.metadata?.apiRequirements).toEqual(['DEMO_API_KEY'])
    expect(catalog.demo_skill?.metadata?.callableVia?.[0]).toContain('demo-mcp')
  })

  it('builds env example content', () => {
    expect(buildEnvExampleContent(registry.sources[0]!)).toContain('DEMO_API_KEY=replace-demo-key')
  })

  it('builds generated readme block', () => {
    const block = buildReadmeGeneratedBlock(registry)
    expect(block).toContain('<!-- generated:sources:start -->')
    expect(block).toContain('| demo_skill | skill | demo | npx skills add demo | .env.demo.local |')
  })
})
