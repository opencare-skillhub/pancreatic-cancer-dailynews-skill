import { itemSchema, type DigestItem } from '../schema/item.js'
import { groupSections } from './sectioning.js'
import { renderMarkdown } from '../output/markdown.js'
import { fetchClinicalTrials } from '../sources/clinical_trials.js'
import { buildFallbackSectionItems } from '../sources/fallback_sections.js'
import { fetchPubmed } from '../sources/pubmed.js'
import { createSearchAbility, type SearchAbility } from '../abilities/search_ability.js'

export type PipelineInput = {
  date: string
  profile: string
  items: DigestItem[]
}

export type PipelineReport = {
  profile: string
  sections: ReturnType<typeof groupSections>
  markdown: string
}

export type CoreSourceDeps = {
  fetchClinicalTrials?: typeof fetchClinicalTrials
  fetchPubmed?: typeof fetchPubmed
  buildFallbackSectionItems?: typeof buildFallbackSectionItems
  searchAbility?: SearchAbility
  onDiagnostic?: (event: { stage: string; detail: Record<string, unknown> }) => void
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function buildWebSearchQuery(input: Pick<PipelineInput, 'date' | 'profile'>): string {
  return `pancreatic cancer digest ${input.profile} ${input.date}`
}

export async function collectCoreSources(
  input: { date: string },
  deps: CoreSourceDeps = {},
): Promise<DigestItem[]> {
  const clinicalTrialsFetcher = deps.fetchClinicalTrials ?? fetchClinicalTrials
  const pubmedFetcher = deps.fetchPubmed ?? fetchPubmed
  const fallbackBuilder = deps.buildFallbackSectionItems ?? buildFallbackSectionItems
  const searchAbility = deps.searchAbility ?? createSearchAbility()
  const emitDiagnostic = deps.onDiagnostic ?? (() => undefined)
  const pubmed = await pubmedFetcher(input.date)

  let clinicalTrials: DigestItem[] = []
  let clinicalTrialsOrigin: 'mcp_first' | 'http_fallback' | 'empty' = 'empty'
  try {
    const mcpHits = await searchAbility.search({
      sectionHint: 'clinical_trials_and_drug_rnd',
      topic: '临床试验与药物研发',
      queries: ['pancreatic cancer clinical trials', 'pancreatic cancer KRAS trial', '胰腺癌 临床试验'],
      limit: 10,
    })

    clinicalTrials = mcpHits.map((hit, index) => ({
      id: `mcp:clinical_trials_and_drug_rnd:${input.date}:${index + 1}`,
      title: hit.title,
      summary: hit.summary,
      sourceType: hit.sourceType,
      sectionHint: 'clinical_trials_and_drug_rnd',
      sourceUrl: hit.sourceUrl,
      fetchedAt: new Date().toISOString(),
      evidence: hit.evidence,
    } satisfies DigestItem))
    if (clinicalTrials.length > 0) {
      clinicalTrialsOrigin = 'mcp_first'
    }
  } catch {
    clinicalTrials = []
  }

  if (clinicalTrials.length === 0) {
    clinicalTrials = await clinicalTrialsFetcher(input.date)
    if (clinicalTrials.length > 0) {
      clinicalTrialsOrigin = 'http_fallback'
    }
  }

  emitDiagnostic({
    stage: 'clinical_trials_resolution',
    detail: {
      origin: clinicalTrialsOrigin,
      count: clinicalTrials.length,
      sourceTypes: [...new Set(clinicalTrials.map((item) => item.sourceType))],
    },
  })

  const baseItems = [...clinicalTrials, ...pubmed]
    .filter(isObjectRecord)
    .flatMap((item) => {
      const parsed = itemSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })

  const supplementalItems: DigestItem[] = []
  const now = new Date().toISOString()

  if (!baseItems.some((item) => item.sectionHint === 'research_hotspots')) {
    const hits = await searchAbility.search({
      sectionHint: 'research_hotspots',
      topic: '研究热点',
      queries: ['pancreatic cancer latest research', 'pancreatic cancer PubMed recent review', '胰腺癌 最新 研究'],
      limit: 3,
    })
    supplementalItems.push(...hits.slice(0, 2).map((hit, index) => ({
      id: `ability:research_hotspots:${input.date}:${index + 1}`,
      title: hit.title,
      summary: hit.summary,
      sourceType: hit.sourceType,
      sectionHint: 'research_hotspots',
      sourceUrl: hit.sourceUrl,
      fetchedAt: now,
      evidence: hit.evidence,
    } satisfies DigestItem)))
  }

  const combinedItems = [...baseItems, ...supplementalItems]
  const fallbackItems = await fallbackBuilder(input.date, combinedItems)
  emitDiagnostic({
    stage: 'collect_core_sources_complete',
    detail: {
      baseCount: baseItems.length,
      supplementalCount: supplementalItems.length,
      fallbackCount: fallbackItems.length,
      sectionSourceTypes: Object.fromEntries(
        [...new Set([...combinedItems, ...fallbackItems].map((item) => item.sectionHint))].map((sectionHint) => [
          sectionHint,
          [...new Set([...combinedItems, ...fallbackItems]
            .filter((item) => item.sectionHint === sectionHint)
            .map((item) => item.sourceType))],
        ]),
      ),
    },
  })
  return [...combinedItems, ...fallbackItems]
}

export async function runPipeline(input: PipelineInput): Promise<PipelineReport> {
  const sections = groupSections(input.items)
  const markdown = renderMarkdown(input.date, sections)

  return { profile: input.profile, sections, markdown }
}
