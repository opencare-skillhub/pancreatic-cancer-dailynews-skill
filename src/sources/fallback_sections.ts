import type { DigestItem } from '../schema/item.js'
import { createSearchAbility, type SearchAbility } from '../abilities/search_ability.js'
import { buildDailyEncouragementItemsFromKb } from './psyco_kb.js'

type SectionKeywordConfig = {
  sectionHint: DigestItem['sectionHint']
  topic: string
  queries: string[]
  relevanceKeywords: string[]
}

export type FallbackSectionDeps = {
  ability?: SearchAbility
  buildDailyEncouragementItemsFromKb?: (date: string, now: string) => Promise<DigestItem[]>
}

const fallbackKeywordConfigs: SectionKeywordConfig[] = [
  {
    sectionHint: 'disease_management_guides',
    topic: '病情管理',
    queries: [
      '(pancreatic cancer) AND (infection OR ascites OR gastrointestinal bleeding OR peritonitis OR peritoneal metastasis) AND (guideline OR review)',
      '(pancreatic cancer) AND (ascites OR peritonitis OR biliary drainage OR infection)',
      '(pancreatic cancer) AND (management guideline)',
    ],
    relevanceKeywords: ['infection', 'ascites', 'bleeding', 'peritonitis', 'guideline', 'management'],
  },
  {
    sectionHint: 'nutrition_and_psychology',
    topic: '营养与心理',
    queries: [
      '(pancreatic cancer) AND (nutrition OR cachexia OR sleep OR insomnia OR anxiety OR palliative care) AND (review OR guideline)',
      '(pancreatic cancer) AND (nutrition support OR cachexia OR anxiety OR supportive care)',
      '(pancreatic cancer) AND (nutrition OR cachexia OR anxiety OR sleep)',
      'pancreatic cancer nutrition cachexia supportive care',
    ],
    relevanceKeywords: ['nutrition', 'cachexia', 'sleep', 'insomnia', 'anxiety', 'palliative', 'supportive'],
  },
  {
    sectionHint: 'daily_encouragement',
    topic: '每日支持',
    queries: [
      '(pancreatic cancer) AND (quality of life OR supportive care OR caregiver OR hope OR resilience)',
      '(pancreatic cancer) AND (supportive care OR caregiver burden OR patient reported outcomes)',
      '(pancreatic cancer) AND (quality of life OR psychological support OR caregiver)',
    ],
    relevanceKeywords: ['quality of life', 'supportive', 'caregiver', 'resilience', 'psychological', 'well-being'],
  },
  {
    sectionHint: 'community_and_wechat',
    topic: '社区活动与公众号',
    queries: [
      '小胰宝助手',
      '小胰宝助手 胰腺癌',
      '胰腺癌 小胰宝助手 社区',
      '胰腺癌 营养 小胰宝助手',
    ],
    relevanceKeywords: ['小胰宝', '胰腺癌', '病友', '社区', '营养', '公众号'],
  },
]

export async function buildFallbackSectionItems(
  date: string,
  existingItems: DigestItem[],
  deps: FallbackSectionDeps = {},
): Promise<DigestItem[]> {
  const ability = deps.ability ?? createSearchAbility()
  const buildDailyFromKb = deps.buildDailyEncouragementItemsFromKb ?? buildDailyEncouragementItemsFromKb
  const now = new Date().toISOString()

  const generatedGroups = await Promise.all(
    fallbackKeywordConfigs.map(async (config) => {
      const alreadyFilled = existingItems.some((item) => item.sectionHint === config.sectionHint)
      if (alreadyFilled) return []

      if (config.sectionHint === 'daily_encouragement') {
        const kbItems = await buildDailyFromKb(date, now)
        if (kbItems.length > 0) {
          return kbItems
        }
      }

      const hits = await ability.search({
        sectionHint: config.sectionHint,
        topic: config.topic,
        queries: config.queries,
        limit: 4,
      })

      const filteredHits = hits.filter((hit) => {
        const haystack = `${hit.title} ${hit.summary ?? ''}`.toLowerCase()
        return config.relevanceKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
      })
      const selectedHits = (filteredHits.length > 0 ? filteredHits : hits).slice(0, 2)

      return selectedHits.map((hit, index) => ({
        id: `fallback:${config.sectionHint}:${date}:${index + 1}`,
        title: hit.title,
        summary: hit.summary ?? `围绕胰腺癌${config.topic}的高相关度热点内容，可作为今日延伸阅读。`,
        sourceType: hit.sourceType,
        sectionHint: config.sectionHint,
        sourceUrl: hit.sourceUrl,
        fetchedAt: now,
        evidence: [...hit.evidence, `topic:${config.topic}`],
        scoreBreakdown: {
          evidence: 0.7,
          timeliness: 0.72,
          relevance: 0.92,
          actionability: 0.7,
        },
      } satisfies DigestItem))
    }),
  )

  return generatedGroups.flat()
}
