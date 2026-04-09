import { sectionOrder, type DigestItem } from '../schema/item.js'

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
