import type { DigestItem } from '../schema/item.js'

// 占位适配器：当前仅保留接口骨架，后续会接入真实 PubMed 抓取逻辑。
export async function fetchPubmed(_date: string): Promise<DigestItem[]> {
  return []
}
