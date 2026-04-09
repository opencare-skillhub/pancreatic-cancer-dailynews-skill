import { itemSchema, type DigestItem } from '../schema/item.js'
import { groupSections } from './sectioning.js'
import { renderMarkdown } from '../output/markdown.js'
import { fetchClinicalTrials } from '../sources/clinical_trials.js'
import { fetchPubmed } from '../sources/pubmed.js'

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
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function collectCoreSources(
  input: { date: string },
  deps: CoreSourceDeps = {},
): Promise<DigestItem[]> {
  const clinicalTrialsFetcher = deps.fetchClinicalTrials ?? fetchClinicalTrials
  const pubmedFetcher = deps.fetchPubmed ?? fetchPubmed
  // Task 5 前保持 fail-fast：Promise.all 任一源失败就直接抛出，不做降级合并。
  const [clinicalTrials, pubmed] = await Promise.all([
    clinicalTrialsFetcher(input.date),
    pubmedFetcher(input.date),
  ])

  return [...clinicalTrials, ...pubmed]
    .filter(isObjectRecord)
    .flatMap((item) => {
      const parsed = itemSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
}

export async function runPipeline(input: PipelineInput): Promise<PipelineReport> {
  const sections = groupSections(input.items)
  const markdown = renderMarkdown(input.date, sections)

  return { profile: input.profile, sections, markdown }
}
