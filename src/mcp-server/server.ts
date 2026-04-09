import { runPipeline, type PipelineReport } from '../core/pipeline.js'
import type { DigestItem } from '../schema/item.js'

const toolNames = [
  'digest.run_daily',
  'digest.search_topic',
  'digest.get_section',
  'digest.list_sources',
  'digest.validate_report',
] as const

export type ToolName = (typeof toolNames)[number]

export type RunDailyInput = {
  date: string
  profile: string
  maxItems?: number
  items?: DigestItem[]
}

export type SearchTopicInput = {
  topic: string
  days: number
  items?: DigestItem[]
}

export type GetSectionInput = {
  sectionId: string
  date: string
  profile?: string
  items?: DigestItem[]
}

export type ValidateReportInput = {
  reportId?: string
  markdown?: string
}

export function listToolNames(): ToolName[] {
  return [...toolNames]
}

export async function runDailyDigest(input: RunDailyInput): Promise<PipelineReport> {
  return runPipeline({
    date: input.date,
    profile: input.profile,
    items: input.items?.slice(0, input.maxItems) ?? [],
  })
}

export async function searchTopic(input: SearchTopicInput): Promise<DigestItem[]> {
  const topic = input.topic.toLowerCase().trim()
  return (input.items ?? []).filter((item) => {
    const haystack = `${item.title} ${item.evidence.join(' ')}`.toLowerCase()
    return topic.length > 0 && haystack.includes(topic)
  })
}

export async function getSection(input: GetSectionInput) {
  const report = await runPipeline({
    date: input.date,
    profile: input.profile ?? 'daily-v5',
    items: input.items ?? [],
  })

  return report.sections.find((section) => section.id === input.sectionId) ?? null
}

export function listSources() {
  return [
    { id: 'clinical_trials', enabled: true, health: 'stub' },
    { id: 'pubmed', enabled: true, health: 'stub' },
    { id: 'web_search', enabled: true, health: 'stub' },
  ]
}

export function validateReport(input: ValidateReportInput) {
  const markdown = input.markdown ?? ''
  return {
    ok: markdown.length > 0,
    reportId: input.reportId ?? null,
    hasMarkdown: markdown.length > 0,
  }
}
