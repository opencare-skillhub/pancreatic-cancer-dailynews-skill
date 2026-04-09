import { describe, expect, it } from 'vitest'
import { profileSchema } from '../../src/schema/config.js'
import { itemSchema } from '../../src/schema/item.js'

describe('item schema', () => {
  it('accepts traceable item', () => {
    const parsed = itemSchema.parse({
      id: 'clinicaltrials:NCT123',
      title: 'Phase 3 trial',
      sourceType: 'clinical_trials',
      sectionHint: 'clinical_trials_and_drug_rnd',
      sourceUrl: 'https://clinicaltrials.gov/study/NCT123',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['nct:NCT123'],
    })

    expect(parsed.id).toBe('clinicaltrials:NCT123')
  })

  it('rejects invalid url', () => {
    expect(() =>
      itemSchema.parse({
        id: 'clinicaltrials:NCT123',
        title: 'Phase 3 trial',
        sourceType: 'clinical_trials',
        sectionHint: 'clinical_trials_and_drug_rnd',
        sourceUrl: 'not-a-url',
        fetchedAt: '2026-04-09T08:00:00.000Z',
        evidence: ['nct:NCT123'],
      }),
    ).toThrow()
  })

  it('rejects empty evidence item', () => {
    expect(() =>
      itemSchema.parse({
        id: 'clinicaltrials:NCT123',
        title: 'Phase 3 trial',
        sourceType: 'clinical_trials',
        sectionHint: 'clinical_trials_and_drug_rnd',
        sourceUrl: 'https://clinicaltrials.gov/study/NCT123',
        fetchedAt: '2026-04-09T08:00:00.000Z',
        evidence: [''],
      }),
    ).toThrow()
  })
})

describe('profile schema', () => {
  it('accepts a valid profile', () => {
    const parsed = profileSchema.parse({
      profile: 'default',
      sections: [
        'clinical_trials_and_drug_rnd',
        'research_hotspots',
        'disease_management_guides',
        'nutrition_and_psychology',
        'community_and_wechat',
        'daily_encouragement',
      ],
      dedupWindowDays: 7,
    })

    expect(parsed.profile).toBe('default')
  })

  it('rejects invalid section id', () => {
    expect(() =>
      profileSchema.parse({
        profile: 'default',
        sections: [
          'clinical_trials_and_drug_rnd',
          'research_hotspots',
          'disease_management_guides',
          'nutrition_and_psychology',
          'community_and_wechat',
          'invalid_section',
        ],
        dedupWindowDays: 7,
      }),
    ).toThrow()
  })

  it('rejects duplicate section', () => {
    expect(() =>
      profileSchema.parse({
        profile: 'default',
        sections: [
          'clinical_trials_and_drug_rnd',
          'research_hotspots',
          'disease_management_guides',
          'nutrition_and_psychology',
          'community_and_wechat',
          'community_and_wechat',
        ],
        dedupWindowDays: 7,
      }),
    ).toThrow()
  })
})
