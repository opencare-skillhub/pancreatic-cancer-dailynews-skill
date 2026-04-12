import { describe, expect, it } from 'vitest'
import { loadDependencyCatalog } from '../../src/config/load_dependency_catalog.js'

describe('dependency catalog', () => {
  it('loads seeded third-party skills and mcp entries', async () => {
    const catalog = await loadDependencyCatalog()

    expect(catalog.tavily_search?.metadata?.configPath).toBe('~/.config/tavily/config.json')
    expect(catalog.wechat_search?.metadata?.name).toBe('wechat-article-search')
    expect(catalog.clinical_trials_mcp?.metadata?.repository).toBe('https://github.com/PancrePal-xiaoyibao/xiaoyibao-clinical-trials-mcp-server')
    expect(catalog.clinical_trials_mcp?.install?.command).toBe('npx -y xiaoyibao-clinical-trials')
    expect(catalog.chictr_mcp?.metadata?.deploymentStatus).toBe('npx_preferred')
    expect(catalog.chictr_mcp?.install?.command).toBe('npx -y chictr-mcp-server@latest')
    expect(catalog.metasota_api_mcp?.metadata?.deploymentStatus).toBe('configured_waiting_clone')
    expect(catalog.vibe_writer_pro?.metadata?.name).toBe('Vibe Writer Pro')
    expect(catalog.openclaw_grok_search?.install?.command).toBe('npx skills add https://github.com/stemmaker/openclaw-grok-search --skill openclaw-grok-search')
    expect(catalog.openclaw_grok_search?.metadata?.configPath).toBe('.env.openclaw-grok-search.local')
  })
})
