import { describe, expect, it } from 'vitest'
import { migrateV4ToV5 } from '../../src/config/migrate_v4_to_v5.js'
import { loadProfile } from '../../src/config/load_profile.js'

describe('config migration', () => {
  it('maps v4 sources into v5 profile shape', () => {
    const v4 = { sources: { clinicaltrials: { enabled: true } } }
    const v5 = migrateV4ToV5(v4)

    expect(v5.profile).toBe('daily-v5')
    expect(v5.sources.clinical_trials.enabled).toBe(true)
    expect(v5.sections).toHaveLength(6)
  })

  it('loads a saved profile from config/profiles', async () => {
    const profile = await loadProfile('daily-v5')

    expect(profile.profile).toBe('daily-v5')
    expect(profile.sections).toHaveLength(6)
    expect(profile.dedupWindowDays).toBe(30)
  })
})
