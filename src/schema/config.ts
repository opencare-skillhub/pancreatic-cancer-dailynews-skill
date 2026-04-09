import { z } from 'zod'
import { sectionIdSchema } from './item.js'

export const profileSchema = z.object({
  profile: z.string().trim().min(1),
  sections: z.array(sectionIdSchema).length(6).refine((sections) => new Set(sections).size === sections.length, {
    message: 'sections must not contain duplicates',
  }),
  dedupWindowDays: z.number().int().positive(),
})
