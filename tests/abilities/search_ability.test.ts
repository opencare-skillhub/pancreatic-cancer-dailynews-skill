import { describe, expect, it, vi } from 'vitest'
import { createSearchAbility } from '../../src/abilities/search_ability.js'
import { sourceRegistrySchema } from '../../src/schema/source_registry.js'
import { loadSourcesRegistry } from '../../src/config/load_sources_registry.js'

describe('search ability layer', () => {
  it('selects providers by registry role priority', async () => {
    const registry = sourceRegistrySchema.parse({
      sources: [
        {
          id: 'pubmed_mcp',
          type: 'npm_mcp',
          required: true,
          enabled: true,
          role: 'pubmed_primary',
          check: { kind: 'command', command: 'npx --version' },
        },
        {
          id: 'tavily_search',
          type: 'skill',
          required: false,
          enabled: true,
          role: 'web_search_fallback',
          check: { kind: 'command', command: 'npx --version' },
        },
      ],
    })

    const pubmed = vi.fn().mockResolvedValue([
      {
        title: 'pubmed hit',
        summary: 'pubmed summary',
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/1/',
        sourceType: 'pubmed_mcp',
        evidence: ['pmid:1'],
      },
    ])

    const tavily = vi.fn().mockResolvedValue([
      {
        title: 'tavily hit',
        summary: 'tavily summary',
        sourceUrl: 'https://example.com',
        sourceType: 'tavily_search',
        evidence: ['query:x'],
      },
    ])

    const ability = createSearchAbility({
      registry,
      providerOverrides: {
        pubmed_mcp: pubmed,
        tavily_search: tavily,
      },
    })

    const hits = await ability.search({
      sectionHint: 'disease_management_guides',
      topic: '病情管理',
      queries: ['pancreatic cancer'],
      limit: 2,
    })

    expect(pubmed).toHaveBeenCalled()
    expect(hits[0]?.title).toBe('pubmed hit')
  })

  it('invokes mcp_tool adapter when invokeMcp is provided', async () => {
    const registry = sourceRegistrySchema.parse({
      sources: [
        {
          id: 'clinical_trials_mcp',
          type: 'npm_mcp',
          required: false,
          enabled: true,
          role: 'clinical_trials_primary',
          check: { kind: 'command', command: 'npx --version' },
          abilities: {
            search: {
              enabled: true,
              adapter: 'mcp_tool',
              tool: 'search_clinical_trials',
            },
          },
          mcp: {
            command: 'npx',
            args: ['-y', 'xiaoyibao-clinical-trials'],
          },
        },
      ],
    })

    const invokeMcp = vi.fn().mockResolvedValue([
      {
        title: '试验A',
        sourceUrl: 'https://clinicaltrials.gov/study/NCT00000001',
        summary: '这是摘要',
      },
    ])

    const ability = createSearchAbility({ registry, invokeMcp })
    const hits = await ability.search({
      sectionHint: 'clinical_trials_and_drug_rnd',
      topic: '临床试验',
      queries: ['pancreatic cancer'],
      limit: 2,
    })

    expect(invokeMcp).toHaveBeenCalled()
    expect(hits[0]?.title).toBe('试验A')
  })

  it('supports skill_cli adapter for skill providers', async () => {
    const registry = sourceRegistrySchema.parse({
      sources: [
        {
          id: 'wechat_search',
          type: 'skill',
          required: false,
          enabled: true,
          role: 'community_wechat_search',
          check: { kind: 'command', command: 'npx --version' },
          abilities: {
            search: {
              enabled: true,
              adapter: 'skill_cli',
              command: 'wechat-search --query {query} --max-results {limit} --output json',
            },
          },
        },
      ],
    })

    const skillProvider = vi.fn().mockResolvedValue([
      {
        title: '公众号文章A',
        sourceUrl: 'https://mp.weixin.qq.com/s/demo',
        summary: '这是摘要',
        sourceType: 'wechat_search',
        evidence: ['provider:wechat_search'],
      },
    ])

    const ability = createSearchAbility({
      registry,
      providerOverrides: {
        wechat_search: skillProvider,
      },
    })

    const hits = await ability.search({
      sectionHint: 'community_and_wechat',
      topic: '社区活动',
      queries: ['pancreatic cancer community'],
      limit: 2,
    })

    expect(skillProvider).toHaveBeenCalled()
    expect(hits[0]?.title).toBe('公众号文章A')
  })

  it('supports firecrawl-shaped hits through normalized provider output', async () => {
    const registry = sourceRegistrySchema.parse({
      sources: [
        {
          id: 'firecrawl_search',
          type: 'skill',
          required: false,
          enabled: true,
          role: 'web_search_fallback',
          check: { kind: 'command', command: 'firecrawl --help' },
          abilities: {
            search: {
              enabled: true,
              adapter: 'skill_cli',
              command: 'npx firecrawl search "{query}" --limit {limit} --scrape --json',
            },
          },
        },
      ],
    })

    const firecrawlProvider = vi.fn().mockResolvedValue([
      {
        title: 'Firecrawl Result A',
        sourceUrl: 'https://example.com/a',
        summary: '摘要A',
        sourceType: 'firecrawl_search',
        evidence: ['provider:firecrawl_search'],
      },
    ])

    const ability = createSearchAbility({
      registry,
      providerOverrides: {
        firecrawl_search: firecrawlProvider,
      },
    })

    const hits = await ability.search({
      sectionHint: 'disease_management_guides',
      topic: '病情管理',
      queries: ['pancreatic cancer ascites'],
      limit: 2,
    })

    expect(hits[0]?.title).toBe('Firecrawl Result A')
    expect(hits[0]?.sourceUrl).toBe('https://example.com/a')
  })

  it('activates search abilities for all registry sources', async () => {
    const registry = await loadSourcesRegistry()
    const ability = createSearchAbility({ registry })

    const activeIds = new Set(ability.enabledProviders)
    for (const source of registry.sources) {
      expect(source.abilities?.search?.enabled).toBe(true)
      expect(activeIds.has(source.id)).toBe(true)
    }
  })
})
