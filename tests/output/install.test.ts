import { describe, expect, it } from 'vitest'
import { dependencyCatalogSchema } from '../../src/schema/deployment.js'
import { formatInstallPlan, resolveInstallPlan } from '../../src/output/install.js'

const catalog = dependencyCatalogSchema.parse({
  pubmed_mcp: {
    type: 'npm_mcp',
    required: true,
    role: 'pubmed_primary',
    check: { kind: 'command', command: 'npx --version' },
    install: { kind: 'npm', command: 'npm install -g @scope/pubmed-mcp' },
    fallback: 'stub',
    docs: { homepage: 'https://github.com/example/pubmed-mcp' },
  },
})

describe('install plan', () => {
  it('resolves a source install plan from catalog', () => {
    const plan = resolveInstallPlan(catalog, 'pubmed_mcp')
    expect(plan.command).toBe('npm install -g @scope/pubmed-mcp')
    expect(plan.role).toBe('pubmed_primary')
  })

  it('formats install plan output', () => {
    const output = formatInstallPlan(resolveInstallPlan(catalog, 'pubmed_mcp'))
    expect(output).toContain('Install source: pubmed_mcp')
    expect(output).toContain('Command: npm install -g @scope/pubmed-mcp')
  })
})
