import { describe, expect, it } from 'vitest'
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
})
