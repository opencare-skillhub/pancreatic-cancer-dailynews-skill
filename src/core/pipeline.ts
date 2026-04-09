import type { DigestItem } from '../schema/item.js'
import { groupSections } from './sectioning.js'
import { renderMarkdown } from '../output/markdown.js'

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

export async function runPipeline(input: PipelineInput): Promise<PipelineReport> {
  const sections = groupSections(input.items)
  const markdown = renderMarkdown(input.date, sections)

  return { profile: input.profile, sections, markdown }
}
