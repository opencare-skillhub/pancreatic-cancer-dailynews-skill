import { describe, expect, it } from 'vitest'
import { loadDependencyCatalog } from '../../src/config/load_dependency_catalog.js'
import { loadSourcesRegistry } from '../../src/config/load_sources_registry.js'
import { createSearchAbility } from '../../src/abilities/search_ability.js'

describe('dependency catalog activation coverage', () => {
  it('ensures all dependency-catalog entries are registered and search-ability activated', async () => {
    const [catalog, registry] = await Promise.all([loadDependencyCatalog(), loadSourcesRegistry()])

    const catalogIds = Object.keys(catalog)
    expect(catalogIds.length).toBeGreaterThan(0)

    const sourceById = new Map(registry.sources.map((source) => [source.id, source]))
    for (const id of catalogIds) {
      const source = sourceById.get(id)
      expect(source, `missing source registry entry: ${id}`).toBeDefined()
      expect(source?.enabled, `${id} must be enabled`).toBe(true)
      expect(source?.abilities?.search?.enabled, `${id} must enable abilities.search`).toBe(true)
    }

    const ability = createSearchAbility({ registry })
    const active = new Set(ability.enabledProviders)

    for (const id of catalogIds) {
      expect(active.has(id), `${id} must be activated in search ability`).toBe(true)
    }
  })
})
