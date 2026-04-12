import type { SectionGroup } from '../core/sectioning.js'

const sectionTitles: Record<SectionGroup['id'], string> = {
  clinical_trials_and_drug_rnd: '病友最关心的临床试验和药物研发',
  research_hotspots: '专业研究发表热点文章',
  disease_management_guides: '科普病情管理知识',
  nutrition_and_psychology: '营养和心理',
  community_and_wechat: '社区活动和公众号优质文章',
  daily_encouragement: '每日心理鼓励',
}

function resolveSourceLabel(item: SectionGroup['items'][number]): string {
  if (item.sectionHint === 'community_and_wechat' && item.sourceType === 'wechat_search') {
    const wechatSource = item.evidence.find((entry) => entry.startsWith('wechat_source:'))?.slice('wechat_source:'.length).trim()
    if (wechatSource?.includes('小胰宝助手')) {
      return '小胰宝助手公众号'
    }
    return '其它来源公众号'
  }

  return item.sourceType
}

export function renderMarkdown(date: string, sections: SectionGroup[]): string {
  const lines = [`# 胰腺癌日报 ${date}`]

  sections.forEach((section, index) => {
    lines.push('', `## ${index + 1}. ${sectionTitles[section.id]}`)

    if (section.items.length === 0) {
      lines.push('- 暂无更新（已触发fallback）')
      return
    }

    section.items.forEach((item, itemIndex) => {
      lines.push(`### ${index + 1}.${itemIndex + 1} ${item.title}`)
      lines.push(`- 来源：${resolveSourceLabel(item)}`)
      if (item.summary) {
        lines.push(`- 概要：${item.summary}`)
      }
      lines.push(`- 链接：${item.sourceUrl}`)
    })
  })

  return lines.join('\n')
}
