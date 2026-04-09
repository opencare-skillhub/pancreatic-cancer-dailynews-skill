import type { DigestItem } from '../schema/item.js'
import { callMcpTool } from '../mcp-client/client.js'

export type WebSearchResult = Pick<DigestItem, 'title' | 'sourceUrl'>

export type WebSearchProvider = (
  query: string,
) => Promise<WebSearchResult[]>

export type WebSearchFallbackDeps = {
  primary: WebSearchProvider
  secondary: WebSearchProvider
  invoke?: (tool: string, payload: unknown) => Promise<unknown>
}

export async function searchWebWithFallback(
  query: string,
  deps: WebSearchFallbackDeps,
): Promise<WebSearchResult[]> {
  try {
    return await callMcpTool(
      'web_search.primary',
      { query },
      async (_toolName, payload) => deps.primary((payload as { query: string }).query),
    )
  } catch {
    return callMcpTool(
      'web_search.secondary',
      { query },
      async (_toolName, payload) => deps.secondary((payload as { query: string }).query),
    )
  }
}
