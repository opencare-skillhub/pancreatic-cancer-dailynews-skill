import type { DigestItem } from '../schema/item.js'

export const sectionOrder = [
  'clinical_trials_and_drug_rnd',
  'research_hotspots',
  'disease_management_guides',
  'nutrition_and_psychology',
  'community_and_wechat',
  'daily_encouragement',
] as const

export type SectionId = (typeof sectionOrder)[number]

export type SectionGroup = {
  id: SectionId
  items: DigestItem[]
}

export function groupSections(items: DigestItem[]): SectionGroup[] {
  return sectionOrder.map((id) => ({
    id,
    items: items.filter((item) => item.sectionHint === id),
  }))
}
