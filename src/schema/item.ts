import { z } from 'zod'

export const sectionIdSchema = z.enum([
  'clinical_trials_and_drug_rnd',
  'research_hotspots',
  'disease_management_guides',
  'nutrition_and_psychology',
  'community_and_wechat',
  'daily_encouragement',
])

export const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceType: z.string().min(1),
  sectionHint: sectionIdSchema,
  sourceUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
  evidence: z.array(z.string().trim().min(1)).min(1),
  phase: z.string().optional(),
  scoreBreakdown: z.record(z.string(), z.number()).optional(),
})

export type DigestItem = z.infer<typeof itemSchema>
