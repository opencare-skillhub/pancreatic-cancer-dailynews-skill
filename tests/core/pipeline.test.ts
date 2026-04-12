import { describe, expect, it, vi } from 'vitest'
import { buildWebSearchQuery, collectCoreSources, runPipeline } from '../../src/core/pipeline.js'
import type { DigestItem } from '../../src/schema/item.js'
import { searchWebWithFallback } from '../../src/sources/web_search.js'

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
    expect(report.markdown).toContain('来源：clinical_trials')
    expect(report.markdown).toContain('链接：https://clinicaltrials.gov/study/NCT123')
  })

  it('renders fallback for empty sections', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [item] })

    expect(report.markdown).toContain('暂无更新（已触发fallback）')
  })

  it('renders community wechat source label as other公众号 source', async () => {
    const communityItem: DigestItem = {
      id: 'wechat:1',
      title: '社区活动文章',
      sourceType: 'wechat_search',
      sectionHint: 'community_and_wechat',
      sourceUrl: 'https://weixin.sogou.com/link?demo=1',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['wechat_source:晓得数字化营销增长实验室'],
    }

    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [communityItem] })
    expect(report.markdown).toContain('来源：其它来源公众号')
    expect(report.markdown).not.toContain('晓得数字化营销增长实验室')
  })

  it('collectCoreSources returns an array', async () => {
    const items = await collectCoreSources(
      { date: '2026-04-09' },
      {
        fetchClinicalTrials: vi.fn().mockResolvedValue([]),
        fetchPubmed: vi.fn().mockResolvedValue([]),
        buildFallbackSectionItems: vi.fn().mockResolvedValue([]),
      },
    )

    expect(Array.isArray(items)).toBe(true)
  })

  it('collectCoreSources calls both sources with the same date and concatenates results', async () => {
    const clinicalTrialsItem: DigestItem = {
      id: 'clinicaltrials:1',
      title: 'Clinical trial item',
      sourceType: 'clinical_trials',
      sectionHint: 'clinical_trials_and_drug_rnd',
      sourceUrl: 'https://clinicaltrials.gov/study/1',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['ct:1'],
    }
    const pubmedItem: DigestItem = {
      id: 'pmid:2',
      title: 'PubMed item',
      sourceType: 'pubmed',
      sectionHint: 'research_hotspots',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/2/',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['pmid:2'],
    }
    const clinicalTrialsSpy = vi.fn().mockResolvedValue([clinicalTrialsItem])
    const pubmedSpy = vi.fn().mockResolvedValue([pubmedItem])

    const items = await collectCoreSources(
      { date: '2026-04-09' },
      {
        fetchClinicalTrials: clinicalTrialsSpy,
        fetchPubmed: pubmedSpy,
        searchAbility: {
          enabledProviders: [],
          search: vi.fn().mockResolvedValue([]),
        },
        buildFallbackSectionItems: vi.fn().mockResolvedValue([]),
      },
    )

    expect(clinicalTrialsSpy).toHaveBeenCalledTimes(1)
    expect(pubmedSpy).toHaveBeenCalledTimes(1)
    expect(clinicalTrialsSpy).toHaveBeenCalledWith('2026-04-09')
    expect(pubmedSpy).toHaveBeenCalledWith('2026-04-09')
    expect(items).toEqual([clinicalTrialsItem, pubmedItem])
  })

  it('collectCoreSources filters invalid items and keeps valid ones', async () => {
    const validItem: DigestItem = {
      id: 'pmid:valid',
      title: 'Valid item',
      sourceType: 'pubmed',
      sectionHint: 'research_hotspots',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/valid/',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['pmid:valid'],
    }
    const invalidItem = {
      id: '',
      title: 'Invalid item',
      sourceType: 'pubmed',
      sectionHint: 'research_hotspots',
      sourceUrl: 'not-a-url',
      fetchedAt: '2026-04-09',
      evidence: [],
    }
    const clinicalTrialsSpy = vi.fn().mockResolvedValue([invalidItem])
    const pubmedSpy = vi.fn().mockResolvedValue([validItem])

    const items = await collectCoreSources(
      { date: '2026-04-09' },
      {
        fetchClinicalTrials: clinicalTrialsSpy,
        fetchPubmed: pubmedSpy,
        searchAbility: {
          enabledProviders: [],
          search: vi.fn().mockResolvedValue([]),
        },
        buildFallbackSectionItems: vi.fn().mockResolvedValue([]),
      },
    )

    expect(items).toEqual([validItem])
  })

  it('buildWebSearchQuery encodes date and profile for future search wiring', () => {
    const query = buildWebSearchQuery({ date: '2026-04-09', profile: 'daily-v5' })

    expect(query).toContain('daily-v5')
    expect(query).toContain('2026-04-09')
    expect(query).toContain('pancreatic cancer digest')
  })

  it('searchWebWithFallback returns secondary result when primary fails', async () => {
    const result = await searchWebWithFallback('pancreatic cancer trial', {
      primary: vi.fn().mockRejectedValue(new Error('primary down')),
      secondary: vi.fn().mockResolvedValue([
        { title: 'fallback hit', sourceUrl: 'https://example.com' },
      ]),
    })

    expect(result).toEqual([{ title: 'fallback hit', sourceUrl: 'https://example.com' }])
  })

  it('searchWebWithFallback does not call secondary when primary succeeds', async () => {
    const primary = vi.fn().mockResolvedValue([
      { title: 'primary hit', sourceUrl: 'https://primary.example.com' },
    ])
    const secondary = vi.fn().mockResolvedValue([
      { title: 'secondary hit', sourceUrl: 'https://secondary.example.com' },
    ])

    const result = await searchWebWithFallback('pancreatic cancer trial', {
      primary,
      secondary,
    })

    expect(result).toEqual([
      { title: 'primary hit', sourceUrl: 'https://primary.example.com' },
    ])
    expect(primary).toHaveBeenCalledTimes(1)
    expect(secondary).not.toHaveBeenCalled()
  })

  it('searchWebWithFallback propagates secondary failure', async () => {
    const error = new Error('secondary down')

    await expect(
      searchWebWithFallback('pancreatic cancer trial', {
        primary: vi.fn().mockRejectedValue(new Error('primary down')),
        secondary: vi.fn().mockRejectedValue(error),
      }),
    ).rejects.toThrow('secondary down')
  })

  it('searchWebWithFallback calls provided invoke for both attempts', async () => {
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce([
        { title: 'fallback via invoke', sourceUrl: 'https://example.com' },
      ])

    const result = await searchWebWithFallback('pancreatic cancer trial', {
      primary: vi.fn(),
      secondary: vi.fn(),
      invoke,
    })

    expect(result).toEqual([
      { title: 'fallback via invoke', sourceUrl: 'https://example.com' },
    ])
    expect(invoke).toHaveBeenNthCalledWith(1, 'web_search.primary', { query: 'pancreatic cancer trial' })
    expect(invoke).toHaveBeenNthCalledWith(2, 'web_search.secondary', { query: 'pancreatic cancer trial' })
  })

  it('collectCoreSources supplements clinical trials from ability when primary sources are empty', async () => {
    const items = await collectCoreSources(
      { date: '2026-04-09' },
      {
        fetchClinicalTrials: vi.fn().mockResolvedValue([]),
        fetchPubmed: vi.fn().mockResolvedValue([]),
        searchAbility: {
          enabledProviders: ['clinical_trials_mcp'],
          search: vi.fn().mockImplementation(async (request) => {
            if (request.sectionHint !== 'clinical_trials_and_drug_rnd') return []
            return [
              {
                title: 'MCP Trial A',
                summary: 'Phase 2 招募中',
                sourceUrl: 'https://clinicaltrials.gov/study/NCT0001',
                sourceType: 'clinical_trials_mcp',
                evidence: ['nct:NCT0001'],
              },
            ]
          }),
        },
        buildFallbackSectionItems: vi.fn().mockResolvedValue([]),
      },
    )

    expect(items.some((item) => item.title === 'MCP Trial A')).toBe(true)
    expect(items.some((item) => item.sectionHint === 'clinical_trials_and_drug_rnd')).toBe(true)
  })

  it('collectCoreSources reports diagnostics for clinical trials origin', async () => {
    const diagnostics: Array<{ stage: string; detail: Record<string, unknown> }> = []

    await collectCoreSources(
      { date: '2026-04-09' },
      {
        fetchClinicalTrials: vi.fn().mockResolvedValue([]),
        fetchPubmed: vi.fn().mockResolvedValue([]),
        searchAbility: {
          enabledProviders: ['clinical_trials_mcp'],
          search: vi.fn().mockResolvedValue([
            {
              title: 'Trial from MCP',
              summary: 'summary',
              sourceUrl: 'https://clinicaltrials.gov/study/NCTMCP',
              sourceType: 'clinical_trials_mcp',
              evidence: ['nct:NCTMCP'],
            },
          ]),
        },
        buildFallbackSectionItems: vi.fn().mockResolvedValue([]),
        onDiagnostic: (event) => diagnostics.push(event),
      },
    )

    expect(diagnostics.some((event) => event.stage === 'clinical_trials_resolution')).toBe(true)
    expect(diagnostics.find((event) => event.stage === 'clinical_trials_resolution')?.detail.origin).toBe('mcp_first')
  })
})
