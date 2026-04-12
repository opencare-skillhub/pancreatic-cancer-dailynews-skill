import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { parseSimpleYaml } from './simple_yaml.js'

const searchSourceWhitelistSchema = z.object({
  clinical_trial_sites: z.array(z.string()).default([]),
  research_sites: z.array(z.string()).default([]),
  community_sites: z.array(z.string()).default([]),
  browser_required_sites: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
})

export type SearchSourceWhitelist = z.infer<typeof searchSourceWhitelistSchema>

export async function loadSearchSourceWhitelist(rootDir = process.cwd()): Promise<SearchSourceWhitelist> {
  const filePath = resolve(rootDir, 'config', 'search-source-whitelist.yaml')
  const raw = parseSimpleYaml(await readFile(filePath, 'utf-8'))
  return searchSourceWhitelistSchema.parse(raw)
}
