import type { DigestItem } from '../schema/item.js'
import { callMcpTool } from '../mcp-client/client.js'

export type WebSearchResult = Pick<DigestItem, 'title' | 'sourceUrl'>

export type WebSearchProvider = (
  query: string,
) => Promise<WebSearchResult[]>

export type WebSearchInvoke = (
  tool: string,
  payload: unknown,
) => Promise<WebSearchResult[]>

export type WebSearchFallbackDeps = {
  primary: WebSearchProvider
  secondary: WebSearchProvider
  invoke?: WebSearchInvoke
}

function createDefaultInvoke(deps: WebSearchFallbackDeps): WebSearchInvoke {
  return async (tool, payload) => {
    const query = (payload as { query: string }).query

    if (tool === 'web_search.primary') {
      return deps.primary(query)
    }

    if (tool === 'web_search.secondary') {
      return deps.secondary(query)
    }

    throw new Error(`Unsupported web search tool: ${tool}`)
  }
}

export async function searchWebWithFallback(
  query: string,
  deps: WebSearchFallbackDeps,
): Promise<WebSearchResult[]> {
  const invoke = deps.invoke ?? createDefaultInvoke(deps)

  try {
    return await callMcpTool(
      'web_search.primary',
      { query },
      invoke,
    )
  } catch {
    return callMcpTool(
      'web_search.secondary',
      { query },
      invoke,
    )
  }
}
