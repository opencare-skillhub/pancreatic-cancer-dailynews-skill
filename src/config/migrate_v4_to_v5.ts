import { sectionOrder } from '../schema/item.js'

export function migrateV4ToV5(v4: any) {
  return {
    profile: 'daily-v5',
    sections: [...sectionOrder],
    dedupWindowDays: 30,
    sources: {
      clinical_trials: {
        enabled: Boolean(v4?.sources?.clinicaltrials?.enabled),
      },
    },
  }
}
