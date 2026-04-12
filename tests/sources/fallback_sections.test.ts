import { describe, expect, it } from 'vitest'
import { buildFallbackSectionItems } from '../../src/sources/fallback_sections.js'

describe('fallback sections via search ability', () => {
  it('builds fallback items with title and summary including community section', async () => {
    const items = await buildFallbackSectionItems(
      '2026-04-12',
      [],
      {
        ability: {
          enabledProviders: ['mock'],
          search: async (request) => [
            {
              title: `hit for ${request.topic}`,
              summary: `summary for ${request.topic}`,
              sourceUrl: `https://example.com/${request.sectionHint}`,
              sourceType: 'mock_search',
              evidence: ['mock:evidence'],
            },
          ],
        },
      },
    )

    expect(items.some((item) => item.sectionHint === 'disease_management_guides')).toBe(true)
    expect(items.some((item) => item.sectionHint === 'nutrition_and_psychology')).toBe(true)
    expect(items.some((item) => item.sectionHint === 'community_and_wechat')).toBe(true)
    expect(items.some((item) => item.sectionHint === 'daily_encouragement')).toBe(true)
    expect(items.every((item) => Boolean(item.summary))).toBe(true)
  })
})
