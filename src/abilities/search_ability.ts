import type { SourceRegistry } from '../schema/source_registry.js'
import type { DigestItem } from '../schema/item.js'
import type { SourceRegistryEntry } from '../schema/source_registry.js'
import { callMcpTool } from '../mcp-client/client.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type SearchAbilityHit = {
  title: string
  summary?: string
  sourceUrl: string
  sourceType: string
  evidence: string[]
}

export type SearchAbilityRequest = {
  sectionHint: DigestItem['sectionHint']
  topic: string
  queries: string[]
  limit: number
}

export type SearchProvider = (query: string, limit: number) => Promise<SearchAbilityHit[]>

export type SearchAbility = {
  search: (request: SearchAbilityRequest) => Promise<SearchAbilityHit[]>
  enabledProviders: string[]
}

type CreateSearchAbilityOptions = {
  registry?: SourceRegistry
  providerOverrides?: Partial<Record<string, SearchProvider>>
  invokeMcp?: (tool: string, payload: unknown) => Promise<SearchAbilityHit[]>
}

const rolePriorityBySection: Record<DigestItem['sectionHint'], string[]> = {
  clinical_trials_and_drug_rnd: ['clinical_trials_primary', 'china_trials_primary', 'api_gateway_fallback'],
  research_hotspots: ['pubmed_primary', 'api_gateway_fallback', 'web_search_primary_candidate', 'web_search_fallback'],
  disease_management_guides: ['pubmed_primary', 'api_gateway_fallback', 'web_search_primary_candidate', 'web_search_fallback'],
  nutrition_and_psychology: ['pubmed_primary', 'api_gateway_fallback', 'web_search_primary_candidate', 'web_search_fallback'],
  community_and_wechat: ['community_wechat_search', 'web_search_primary_candidate', 'web_search_fallback', 'api_gateway_fallback'],
  daily_encouragement: ['pubmed_primary', 'api_gateway_fallback', 'web_search_primary_candidate', 'web_search_fallback'],
}

function cleanText(input: string | undefined): string | undefined {
  const value = input?.replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim()
  return value ? value : undefined
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function firstMatch(pattern: RegExp, input: string): string | undefined {
  return cleanText(input.match(pattern)?.[1])
}

function summarizeAbstract(abstractText: string | undefined, topic: string): string {
  const summary = cleanText(abstractText)?.slice(0, 180)
  return summary ? `${summary}${summary.endsWith('.') ? '' : '…'}` : `与胰腺癌${topic}高度相关的热点内容，建议结合原文进一步查看。`
}

async function pubmedProvider(query: string, limit: number): Promise<SearchAbilityHit[]> {
  const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi')
  searchUrl.searchParams.set('db', 'pubmed')
  searchUrl.searchParams.set('term', query)
  searchUrl.searchParams.set('retmode', 'json')
  searchUrl.searchParams.set('retmax', String(limit))
  searchUrl.searchParams.set('sort', 'pub date')

  const searchResp = await fetch(searchUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: 'application/json' },
  })
  if (!searchResp.ok) return []

  const searchData = await searchResp.json() as { esearchresult?: { idlist?: string[] } }
  const ids = searchData.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const fetchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi')
  fetchUrl.searchParams.set('db', 'pubmed')
  fetchUrl.searchParams.set('id', ids.join(','))
  fetchUrl.searchParams.set('retmode', 'xml')

  const fetchResp = await fetch(fetchUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: 'application/xml,text/xml' },
  })
  if (!fetchResp.ok) return []

  const xml = await fetchResp.text()
  const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []

  return articles.flatMap((articleXml) => {
    const pmid = firstMatch(/<PMID[^>]*>([^<]+)<\/PMID>/, articleXml)
    const title = firstMatch(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/, articleXml)?.replace(/<[^>]+>/g, '')
    const abstractParts = [...articleXml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
      .map((match) => cleanText(match[1]?.replace(/<[^>]+>/g, '')))
      .filter((value): value is string => Boolean(value))

    if (!pmid || !title) return []

    return [{
      title: decodeHtmlEntities(title),
      summary: summarizeAbstract(abstractParts.join(' '), '主题'),
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      sourceType: 'pubmed_mcp',
      evidence: [`pmid:${pmid}`, `query:${query}`],
    }]
  }).slice(0, limit)
}

function noopProvider(): Promise<SearchAbilityHit[]> {
  return Promise.resolve([])
}

function normalizeHits(value: unknown, defaultSourceType: string): SearchAbilityHit[] {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const articles = record.articles
    if (Array.isArray(articles)) {
      return articles.flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const item = row as Record<string, unknown>
        const title = typeof item.title === 'string' ? item.title : undefined
        const sourceUrl = typeof item.url === 'string' ? item.url : undefined
        if (!title || !sourceUrl) return []

        const summaryParts = [
          typeof item.summary === 'string' ? item.summary : undefined,
          typeof item.source === 'string' ? `公众号：${item.source}` : undefined,
          typeof item.date_text === 'string' ? `日期：${item.date_text}` : undefined,
        ].filter(Boolean)

        return [{
          title: cleanText(title) ?? title,
          summary: cleanText(summaryParts.join('；')),
          sourceUrl,
          sourceType: defaultSourceType,
          evidence: [
            ...(typeof item.source === 'string' ? [`wechat_source:${item.source}`] : []),
          ],
        } satisfies SearchAbilityHit]
      })
    }

    const webResults = record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>).web
      : undefined

    if (Array.isArray(webResults)) {
      return webResults.flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const item = row as Record<string, unknown>
        const title = typeof item.title === 'string' ? item.title : undefined
        const sourceUrl = typeof item.url === 'string' ? item.url : undefined
        if (!title || !sourceUrl) return []

        const summary = typeof item.description === 'string'
          ? item.description
          : (typeof item.markdown === 'string' ? item.markdown.slice(0, 240) : undefined)

        return [{
          title: cleanText(title) ?? title,
          summary: cleanText(summary),
          sourceUrl,
          sourceType: defaultSourceType,
          evidence: [],
        } satisfies SearchAbilityHit]
      })
    }
  }

  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title : undefined
    const sourceUrl = typeof record.sourceUrl === 'string'
      ? record.sourceUrl
      : (typeof record.url === 'string' ? record.url : undefined)
    if (!title || !sourceUrl) return []

    return [{
      title: cleanText(title) ?? title,
      summary: typeof record.summary === 'string' ? cleanText(record.summary) : undefined,
      sourceUrl,
      sourceType: typeof record.sourceType === 'string' ? record.sourceType : defaultSourceType,
      evidence: Array.isArray(record.evidence)
        ? record.evidence.filter((v): v is string => typeof v === 'string')
        : [],
    } satisfies SearchAbilityHit]
  })
}

function normalizeMcpToolResult(value: unknown, source: SourceRegistryEntry, query: string): SearchAbilityHit[] {
  if (Array.isArray(value)) {
    if (source.id === 'chictr_mcp') {
      return value.flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const record = row as Record<string, unknown>
        const registrationNumber = typeof record.registration_number === 'string' ? record.registration_number : undefined
        const title = typeof record.title === 'string' ? record.title : undefined
        if (!registrationNumber || !title) return []

        return [{
          title: cleanText(title) ?? title,
          summary: [
            typeof record.study_type === 'string' ? `研究类型：${record.study_type}` : undefined,
            typeof record.registration_date === 'string' ? `登记日期：${record.registration_date}` : undefined,
            typeof record.institution === 'string' ? `机构：${record.institution}` : undefined,
          ].filter(Boolean).join('；'),
          sourceUrl: `https://www.chictr.org.cn/showproj.html?proj=${encodeURIComponent(registrationNumber)}`,
          sourceType: source.id,
          evidence: [`registration_number:${registrationNumber}`, `query:${query}`],
        } satisfies SearchAbilityHit]
      })
    }

    return normalizeHits(value, source.id)
  }

  if (source.id === 'clinical_trials_mcp' && value && typeof value === 'object') {
    const studies = (value as { studies?: unknown[] }).studies ?? []
    if (!Array.isArray(studies)) return []
    return studies.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const record = row as Record<string, unknown>
      const nctId = typeof record.nctId === 'string' ? record.nctId : undefined
      const title = typeof record.title === 'string' ? record.title : undefined
      if (!nctId || !title) return []

      const phase = Array.isArray(record.phase) ? record.phase.filter((v): v is string => typeof v === 'string').join(', ') : undefined
      const status = typeof record.status === 'string' ? record.status : undefined
      const sponsor = typeof record.sponsor === 'string' ? record.sponsor : undefined
      const summary = typeof record.summary === 'string' ? record.summary : undefined

      return [{
        title: cleanText(title) ?? title,
        summary: cleanText(summary) ?? [phase ? `阶段：${phase}` : undefined, status ? `状态：${status}` : undefined, sponsor ? `发起方：${sponsor}` : undefined].filter(Boolean).join('；'),
        sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
        sourceType: source.id,
        evidence: [`nct:${nctId}`, `query:${query}`],
      } satisfies SearchAbilityHit]
    })
  }

  return normalizeHits(value, source.id)
}

function makePubmedProvider(): SearchProvider {
  return pubmedProvider
}

function makeTavilyProvider(source: SourceRegistryEntry): SearchProvider {
  return async (query, limit) => {
    const apiKey = process.env.TAVILY_API_KEY ?? process.env.TAVILY_API_TOKEN
    if (!apiKey) return []
    const endpoint = source.abilities?.search?.endpoint ?? 'https://api.tavily.com/search'

    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: limit,
        include_answer: false,
        search_depth: 'advanced',
      }),
    })
    if (!response.ok) return []

    const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> }
    return (data.results ?? []).flatMap((item) => {
      if (!item.title || !item.url) return []
      return [{
        title: cleanText(item.title) ?? item.title,
        summary: cleanText(item.content),
        sourceUrl: item.url,
        sourceType: source.id,
        evidence: [`provider:${source.id}`, `query:${query}`],
      } satisfies SearchAbilityHit]
    })
  }
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i)
      ?? text.match(/(\{[\s\S]*\})/)
      ?? text.match(/(\[[\s\S]*\])/)
    if (!match?.[1]) return null
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
}

function makeOpenclawGrokProvider(source: SourceRegistryEntry): SearchProvider {
  return async (query, limit) => {
    const endpoint = source.abilities?.search?.endpoint ?? process.env.GROK_BASE_URL
    const apiKey = process.env.GROK_API_KEY
    if (!endpoint || !apiKey) return []

    const normalizedEndpoint = endpoint.endsWith('/v1/chat/completions')
      ? endpoint
      : `${endpoint.replace(/\/+$/, '')}/v1/chat/completions`

    const prompt = [
      'You are a medical search assistant.',
      `Return ONLY JSON array with up to ${limit} objects.`,
      'Each object must contain: title, sourceUrl, summary.',
      `Topic query: ${query}`,
    ].join('\n')

    const response = await fetch(normalizedEndpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL ?? 'grok-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    })
    if (!response.ok) return []

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    const parsed = parseJsonFromText(text)
    return normalizeHits(parsed, source.id).map((hit) => ({
      ...hit,
      evidence: [...hit.evidence, `provider:${source.id}`, `query:${query}`],
    }))
  }
}

function makeMcpToolProvider(
  source: SourceRegistryEntry,
  invokeMcp?: (tool: string, payload: unknown) => Promise<SearchAbilityHit[]>,
): SearchProvider {
  return async (query, limit) => {
    const tool = source.abilities?.search?.tool
    if (!tool || !invokeMcp) return []

    const payload = source.id === 'clinical_trials_mcp'
      ? { condition: 'Pancreatic Cancer', keywords: query, pageSize: limit }
      : source.id === 'chictr_mcp'
        ? { keyword: query, max_results: limit }
        : { query, limit }

    const result = await callMcpTool(tool, payload, invokeMcp)
    return normalizeMcpToolResult(result, source, query).map((hit) => ({
      ...hit,
      evidence: [...hit.evidence, `provider:${source.id}`, `query:${query}`, `tool:${tool}`],
    }))
  }
}

function parseCommand(command: string, query: string, limit: number): { file: string; args: string[] } {
  const interpolated = command
    .replaceAll('{query}', query)
    .replaceAll('{limit}', String(limit))

  const parts = interpolated.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  const normalized = parts.map((part) => part.replace(/^['"]|['"]$/g, ''))
  const [file, ...args] = normalized
  if (!file) {
    throw new Error(`Invalid skill command: ${command}`)
  }
  return { file, args }
}

function makeSkillCliProvider(source: SourceRegistryEntry): SearchProvider {
  return async (query, limit) => {
    const command = source.abilities?.search?.command
    if (!command) return []

    const { file, args } = parseCommand(command, query, limit)
    const { stdout } = await execFileAsync(file, args, {
      timeout: 25_000,
      maxBuffer: 1024 * 1024 * 2,
      env: process.env,
    })

    const parsed = parseJsonFromText(stdout)
    return normalizeHits(parsed, source.id).map((hit) => ({
      ...hit,
      evidence: [...hit.evidence, `provider:${source.id}`, `query:${query}`],
    }))
  }
}

function buildProviderForSource(
  source: SourceRegistryEntry,
  options: CreateSearchAbilityOptions,
): SearchProvider {
  const override = options.providerOverrides?.[source.id]
  if (override) return override

  const adapter = source.abilities?.search?.adapter
  if (!adapter || source.abilities?.search?.enabled === false) return noopProvider
  if (adapter === 'pubmed_eutils') return makePubmedProvider()
  if (adapter === 'tavily_http') return makeTavilyProvider(source)
  if (adapter === 'openclaw_grok_compatible') return makeOpenclawGrokProvider(source)
  if (adapter === 'mcp_tool') return makeMcpToolProvider(source, options.invokeMcp)
  if (adapter === 'skill_cli') return makeSkillCliProvider(source)
  return noopProvider
}

export function createSearchAbility(options: CreateSearchAbilityOptions = {}): SearchAbility {
  const registrySources = options.registry?.sources ?? []
  const defaultEnabled = ['pubmed_mcp']
  const enabledSources = registrySources.length > 0
    ? registrySources
      .filter((source) => source.enabled && source.abilities?.search?.enabled !== false)
      .map((source) => source.id)
    : defaultEnabled

  const providersById: Record<string, SearchProvider> = Object.fromEntries(
    registrySources
      .filter((source) => source.enabled)
      .map((source) => [source.id, buildProviderForSource(source, options)]),
  )

  const byRole = new Map<string, string[]>()
  for (const source of registrySources) {
    if (!source.enabled) continue
    const current = byRole.get(source.role) ?? []
    current.push(source.id)
    byRole.set(source.role, current)
  }

  const selectProviders = (sectionHint: DigestItem['sectionHint']): SearchProvider[] => {
    const rolePriority = rolePriorityBySection[sectionHint] ?? []
    const idsByRole = rolePriority.flatMap((role) => byRole.get(role) ?? [])
    const ids = idsByRole.length > 0 ? idsByRole : enabledSources
    return ids
      .map((id) => providersById[id])
      .filter((provider): provider is SearchProvider => Boolean(provider))
  }

  return {
    enabledProviders: enabledSources,
    search: async (request) => {
      const providers = selectProviders(request.sectionHint)
      if (providers.length === 0) {
        return []
      }

      const collected: SearchAbilityHit[] = []
      const seen = new Set<string>()

      for (const query of request.queries) {
        for (const provider of providers) {
          try {
            const hits = await provider(query, request.limit)
            for (const hit of hits) {
              if (seen.has(hit.sourceUrl)) continue
              seen.add(hit.sourceUrl)
              collected.push(hit)
              if (collected.length >= request.limit) {
                return collected
              }
            }
          } catch {
            // continue next provider
          }
        }
      }

      return collected
    },
  }
}
