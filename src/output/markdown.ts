import type { SectionGroup } from '../core/sectioning.js'

export function renderMarkdown(date: string, sections: SectionGroup[]): string {
  const lines = [`# 胰腺癌日报 ${date}`]

  sections.forEach((section, index) => {
    lines.push('', `## ${index + 1}. ${section.id}`)

    if (section.items.length === 0) {
      lines.push('- 暂无更新（已触发fallback）')
      return
    }

    section.items.forEach((item) => {
      lines.push(`- ${item.title} (${item.sourceUrl})`)
    })
  })

  return lines.join('\n')
}
