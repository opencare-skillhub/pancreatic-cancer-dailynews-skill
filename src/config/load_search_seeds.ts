import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { parseSimpleYaml } from './simple_yaml.js'

const searchSeedsSchema = z.object({
  clinical_trial_seed_urls: z.array(z.string().url()).default([]),
  research_seed_urls: z.array(z.string().url()).default([]),
  community_seed_urls: z.array(z.string().url()).default([]),
  notes: z.array(z.string()).default([]),
})

export type SearchSeeds = z.infer<typeof searchSeedsSchema>

export async function loadSearchSeeds(rootDir = process.cwd()): Promise<SearchSeeds> {
  const filePath = resolve(rootDir, 'config', 'search-seeds.yaml')
  const raw = parseSimpleYaml(await readFile(filePath, 'utf-8'))
  return searchSeedsSchema.parse(raw)
}
