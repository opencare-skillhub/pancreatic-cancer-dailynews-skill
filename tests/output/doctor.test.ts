import { describe, expect, it, vi } from 'vitest'
import { dependencyCatalogSchema } from '../../src/schema/deployment.js'
import { formatDoctorReport, runDoctor } from '../../src/output/doctor.js'

const catalog = dependencyCatalogSchema.parse({
  clinical_trials_mcp: {
    type: 'npm_mcp',
    required: true,
    role: 'clinical_trials_primary',
    check: { kind: 'command', command: 'node --version' },
    install: { kind: 'npm', command: 'npm install -g clinical-trials-mcp' },
  },
  tavily_search: {
    type: 'skill',
    required: false,
    role: 'web_search_fallback',
    check: { kind: 'skill_exists', skill: 'tavily-search' },
    install: { kind: 'github_skill', command: 'install skill tavily-search' },
  },
})

describe('doctor', () => {
  it('filters to skills only', async () => {
    const report = await runDoctor(
      { command: 'doctor', skillsOnly: true },
      catalog,
      {
        skillExists: vi.fn().mockResolvedValue(true),
      },
    )

    expect(report.items).toHaveLength(1)
    expect(report.items[0]?.id).toBe('tavily_search')
  })

  it('includes environment and source checks by default', async () => {
    const report = await runDoctor(
      { command: 'doctor' },
      catalog,
      {
        commandExists: vi.fn().mockResolvedValue(true),
        skillExists: vi.fn().mockResolvedValue(false),
      },
    )

    expect(report.items.some((item) => item.id === 'node')).toBe(true)
    expect(report.items.some((item) => item.id === 'clinical_trials_mcp')).toBe(true)
    expect(report.items.some((item) => item.id === 'tavily_search')).toBe(true)
    expect(report.pendingActions).toContain('Install tavily_search: install skill tavily-search')
  })

  it('formats fix mode with confirmation prompt', () => {
    const output = formatDoctorReport(
      {
        items: [
          { id: 'tavily_search', kind: 'skill', status: 'missing', summary: 'tavily_search is missing', installCommand: 'install skill tavily-search' },
        ],
        pendingActions: ['Install tavily_search: install skill tavily-search'],
      },
      true,
    )

    expect(output).toContain('Pending actions:')
    expect(output).toContain('Continue? [y/N]')
  })
})
