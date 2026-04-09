import { z } from 'zod'

export const profileSchema = z.object({
  profile: z.string(),
  sections: z.array(z.string()).length(6),
  dedupWindowDays: z.number().int().positive(),
})
