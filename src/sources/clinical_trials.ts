import type { DigestItem } from '../schema/item.js'

// 占位适配器：当前仅保留接口骨架，后续会接入真实 ClinicalTrials.gov 抓取逻辑。
export async function fetchClinicalTrials(_date: string): Promise<DigestItem[]> {
  return []
}
