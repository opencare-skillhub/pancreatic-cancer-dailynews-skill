import type { DigestItem } from '../schema/item.js'

type PubmedSearchResponse = {
  esearchresult?: {
    idlist?: string[]
  }
}

type PubmedSummaryItem = {
  uid?: string
  title?: string
  pubdate?: string
  fulljournalname?: string
  authors?: Array<{ name?: string }>
}

type PubmedSummaryResponse = {
  result?: Record<string, PubmedSummaryItem | string[]>
}

function buildPubmedQuery(): string {
  return '(Pancreatic Neoplasms[MeSH Terms]) AND ("last 14 days"[PDat])'
}

export async function fetchPubmed(_date: string): Promise<DigestItem[]> {
  try {
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi')
    searchUrl.searchParams.set('db', 'pubmed')
    searchUrl.searchParams.set('term', buildPubmedQuery())
    searchUrl.searchParams.set('retmode', 'json')
    searchUrl.searchParams.set('retmax', '10')
    searchUrl.searchParams.set('sort', 'pub date')

    const searchResp = await fetch(searchUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'application/json' },
    })
    if (!searchResp.ok) {
      return []
    }

    const searchData = await searchResp.json() as PubmedSearchResponse
    const ids = searchData.esearchresult?.idlist ?? []
    if (ids.length === 0) {
      return []
    }

    const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi')
    summaryUrl.searchParams.set('db', 'pubmed')
    summaryUrl.searchParams.set('id', ids.join(','))
    summaryUrl.searchParams.set('retmode', 'json')

    const summaryResp = await fetch(summaryUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'application/json' },
    })
    if (!summaryResp.ok) {
      return []
    }

    const summaryData = await summaryResp.json() as PubmedSummaryResponse
    const now = new Date().toISOString()

    return ids.flatMap((id) => {
      const article = summaryData.result?.[id]
      if (!article || Array.isArray(article) || typeof article === 'string') {
        return []
      }

      const title = article.title?.trim()
      if (!title) {
        return []
      }

      const journal = article.fulljournalname?.trim()
      const pubdate = article.pubdate?.trim()
      const firstAuthor = article.authors?.[0]?.name?.trim()

      return [{
        id: `pmid:${id}`,
        title,
        sourceType: 'pubmed',
        sectionHint: 'research_hotspots',
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        fetchedAt: now,
        evidence: [
          `pmid:${id}`,
          ...(journal ? [`journal:${journal}`] : []),
          ...(pubdate ? [`pubdate:${pubdate}`] : []),
          ...(firstAuthor ? [`author:${firstAuthor}`] : []),
        ],
        scoreBreakdown: {
          evidence: 0.95,
          timeliness: 0.85,
          relevance: 0.95,
          actionability: 0.65,
        },
      } satisfies DigestItem]
    })
  } catch {
    return []
  }
}
