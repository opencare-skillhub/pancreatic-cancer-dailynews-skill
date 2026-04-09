import { describe, expect, it } from 'vitest'
import { listToolNames, runDailyDigest, searchTopic, getSection, listSources, validateReport } from '../../src/mcp-server/server.js'
import type { DigestItem } from '../../src/schema/item.js'

describe('mcp server tools', () => {
  it('registers required tools', () => {
    expect(listToolNames()).toEqual([
      'digest.run_daily',
      'digest.search_topic',
      'digest.get_section',
      'digest.list_sources',
      'digest.validate_report',
    ])
  })

  it('runDailyDigest returns pipeline-backed report', async () => {
    const report = await runDailyDigest({
      date: '2026-04-09',
      profile: 'daily-v5',
      items: [],
    })

    expect(report.profile).toBe('daily-v5')
    expect(report.sections).toHaveLength(6)
  })

  it('searchTopic filters matching items', async () => {
    const items: DigestItem[] = [
      {
        id: 'pmid:1',
        title: 'KRAS pancreatic cancer update',
        sourceType: 'pubmed',
        sectionHint: 'research_hotspots',
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/1/',
        fetchedAt: '2026-04-09T08:00:00.000Z',
        evidence: ['pmid:1'],
      },
    ]

    const result = await searchTopic({ topic: 'KRAS', days: 7, items })
    expect(result).toHaveLength(1)
  })

  it('getSection returns a single section payload', async () => {
    const items: DigestItem[] = [
      {
        id: 'ct:1',
        title: 'Trial one',
        sourceType: 'clinical_trials',
        sectionHint: 'clinical_trials_and_drug_rnd',
        sourceUrl: 'https://clinicaltrials.gov/study/1',
        fetchedAt: '2026-04-09T08:00:00.000Z',
        evidence: ['ct:1'],
      },
    ]

    const section = await getSection({
      sectionId: 'clinical_trials_and_drug_rnd',
      date: '2026-04-09',
      items,
    })

    expect(section?.id).toBe('clinical_trials_and_drug_rnd')
    expect(section?.items).toHaveLength(1)
  })

  it('listSources exposes current source registry', () => {
    expect(listSources()).toEqual([
      { id: 'clinical_trials', enabled: true, health: 'stub' },
      { id: 'pubmed', enabled: true, health: 'stub' },
      { id: 'web_search', enabled: true, health: 'stub' },
    ])
  })

  it('validateReport checks markdown presence', () => {
    expect(validateReport({ markdown: '# report' }).ok).toBe(true)
    expect(validateReport({ markdown: '' }).ok).toBe(false)
  })
})
