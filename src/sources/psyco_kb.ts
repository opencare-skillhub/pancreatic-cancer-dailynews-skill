import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DigestItem } from '../schema/item.js'

type PsycoEncouragementEntry = {
  id: string
  title: string
  text: string
  source: string
}

type PsycoMicroActionEntry = {
  id: string
  title: string
  guide?: string
  tip?: string
  source: string
}

type PsycoKbData = {
  encouragements?: PsycoEncouragementEntry[]
  micro_actions?: PsycoMicroActionEntry[]
}

let cached: PsycoKbData | null = null

async function loadPsycoKb(rootDir = process.cwd()): Promise<PsycoKbData> {
  if (cached) {
    return cached
  }

  const filePath = resolve(rootDir, 'config', 'psyco_kb', 'daily_encouragement_kb.json')
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as PsycoKbData
    cached = parsed
    return parsed
  } catch {
    cached = {}
    return {}
  }
}

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickOne<T>(list: T[], seed: string): T | undefined {
  if (list.length === 0) return undefined
  const index = hashSeed(seed) % list.length
  return list[index]
}

function toDigestItem(
  date: string,
  now: string,
  order: number,
  title: string,
  summary: string,
  sourceId: string,
  evidence: string[],
): DigestItem {
  return {
    id: `fallback:daily_encouragement:${date}:${order}`,
    title,
    summary,
    sourceType: 'psyco_kb',
    sectionHint: 'daily_encouragement',
    sourceUrl: `https://local.xiaoyibao/psyco_kb/${encodeURIComponent(sourceId)}`,
    fetchedAt: now,
    evidence,
    scoreBreakdown: {
      evidence: 0.9,
      timeliness: 0.75,
      relevance: 0.9,
      actionability: 0.86,
    },
  }
}

export async function buildDailyEncouragementItemsFromKb(date: string, now: string): Promise<DigestItem[]> {
  const kb = await loadPsycoKb()
  const encouragements = kb.encouragements ?? []
  const microActions = kb.micro_actions ?? []

  const pickedEncouragement = pickOne(encouragements, `${date}:encouragement`)
  const pickedAction = pickOne(microActions, `${date}:micro_action`)

  const items: DigestItem[] = []

  if (pickedEncouragement?.text) {
    items.push(
      toDigestItem(
        date,
        now,
        1,
        `每日心理鼓励｜${pickedEncouragement.title}`,
        pickedEncouragement.text,
        pickedEncouragement.id,
        ['source:psyco_kb', `file:${pickedEncouragement.source}`],
      ),
    )
  }

  if (pickedAction) {
    const summary = `${pickedAction.guide ?? ''}${pickedAction.tip ? `\n\n生理贴士：${pickedAction.tip}` : ''}`.trim()
    if (summary) {
      items.push(
        toDigestItem(
          date,
          now,
          2,
          `今日微行动｜${pickedAction.title}`,
          summary,
          pickedAction.id,
          ['source:psyco_kb', `file:${pickedAction.source}`],
        ),
      )
    }
  }

  return items
}

export function __resetPsycoKbCacheForTests() {
  cached = null
}
