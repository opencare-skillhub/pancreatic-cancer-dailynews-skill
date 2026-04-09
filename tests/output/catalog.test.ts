import { describe, expect, it } from 'vitest'
import { loadDependencyCatalog } from '../../src/config/load_dependency_catalog.js'

describe('dependency catalog', () => {
  it('loads seeded third-party skills and mcp entries', async () => {
    const catalog = await loadDependencyCatalog()

    expect(catalog.tavily_search?.metadata?.localPath).toBe('/home/gem/workspace/agent/workspace/.agents/skills/tavily-search/')
    expect(catalog.wechat_search?.metadata?.version).toBe('v1.0.3')
    expect(catalog.clinical_trials_mcp?.metadata?.repository).toBe('https://github.com/PancrePal-xiaoyibao/xiaoyibao-clinical-trials-mcp-server')
    expect(catalog.chictr_mcp?.metadata?.deploymentStatus).toBe('installed_built')
    expect(catalog.metasota_api_mcp?.metadata?.deploymentStatus).toBe('configured_waiting_clone')
    expect(catalog.vibe_writer_pro?.metadata?.name).toBe('Vibe Writer Pro')
  })
})
