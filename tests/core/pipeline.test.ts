import { describe, expect, it } from 'vitest'
import { collectCoreSources, runPipeline } from '../../src/core/pipeline.js'
import type { DigestItem } from '../../src/schema/item.js'

describe('pipeline', () => {
  const item: DigestItem = {
    id: 'clinicaltrials:NCT123',
    title: 'Phase 3 trial',
    sourceType: 'clinical_trials',
    sectionHint: 'clinical_trials_and_drug_rnd',
    sourceUrl: 'https://clinicaltrials.gov/study/NCT123',
    fetchedAt: '2026-04-09T08:00:00.000Z',
    evidence: ['nct:NCT123'],
  }

  it('returns six sections and uses profile in report', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [] })

    expect(report.sections.length).toBe(6)
    expect(report.profile).toBe('daily-v5')
    expect(report.markdown.includes('## 1.')).toBe(true)
  })

  it('keeps section order stable', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [item] })

    expect(report.sections[0]?.id).toBe('clinical_trials_and_drug_rnd')
    expect(report.sections[1]?.id).toBe('research_hotspots')
  })

  it('renders item title and url in markdown', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [item] })

    expect(report.markdown).toContain('Phase 3 trial')
    expect(report.markdown).toContain('https://clinicaltrials.gov/study/NCT123')
  })

  it('renders fallback for empty sections', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [item] })

    expect(report.markdown).toContain('暂无更新（已触发fallback）')
  })

  it('collectCoreSources returns an array', async () => {
    const items = await collectCoreSources('2026-04-09')

    expect(Array.isArray(items)).toBe(true)
  })
})
