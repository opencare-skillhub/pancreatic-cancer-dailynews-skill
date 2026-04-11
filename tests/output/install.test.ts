import { describe, expect, it } from 'vitest'
import { dependencyCatalogSchema } from '../../src/schema/deployment.js'
import {
  classifyInstallFailure,
  formatConfigGuidance,
  formatInstallQueue,
  formatFailureGuidance,
  formatInstallPlan,
  formatInstallResults,
  resolveInstallPlan,
  sortInstallPlans,
} from '../../src/output/install.js'

const catalog = dependencyCatalogSchema.parse({
  pubmed_mcp: {
    type: 'npm_mcp',
    required: true,
    role: 'pubmed_primary',
    check: { kind: 'command', command: 'npx --version' },
    install: { kind: 'npm', command: 'npm install -g @scope/pubmed-mcp' },
    fallback: 'stub',
    docs: { homepage: 'https://github.com/example/pubmed-mcp' },
    metadata: {
      configPath: '.env.pubmed.local',
      apiRequirements: ['PUBMED_API_KEY'],
    },
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

  it('formats config reminders and install results', () => {
    const plan = resolveInstallPlan(catalog, 'pubmed_mcp')
    expect(formatConfigGuidance([plan])).toContain('.env.pubmed.local')
    expect(
      formatInstallResults([{ id: 'pubmed_mcp', command: plan.command, success: true, exitCode: 0 }]),
    ).toContain('pubmed_mcp: OK')
  })

  it('classifies install failures and formats hints', () => {
    expect(classifyInstallFailure(127)).toBe('command_not_found')
    expect(classifyInstallFailure(1, 'permission denied')).toBe('permission')
    expect(
      formatFailureGuidance([{ id: 'pubmed_mcp', command: 'x', success: false, exitCode: 127, failureKind: 'command_not_found' }]),
    ).toContain('PATH')
  })

  it('sorts install plans by type and formats queue', () => {
    const sorted = sortInstallPlans([
      { ...resolveInstallPlan(catalog, 'pubmed_mcp') },
      {
        id: 'skill_a',
        role: 'search',
        command: 'npx skills add skill_a',
        type: 'skill',
        installKind: 'github_skill',
      },
    ])

    expect(sorted[0]?.id).toBe('skill_a')
    expect(formatInstallQueue(sorted)).toContain('1. skill_a [skill/github_skill]')
  })
})
