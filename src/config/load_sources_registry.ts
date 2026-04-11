import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sourceRegistrySchema, type SourceRegistry } from '../schema/source_registry.js'
import { parseSimpleYaml } from './simple_yaml.js'

export async function loadSourcesRegistry(rootDir = process.cwd()): Promise<SourceRegistry> {
  const filePath = resolve(rootDir, 'config', 'sources.registry.yaml')
  const raw = parseSimpleYaml(await readFile(filePath, 'utf-8'))
  return sourceRegistrySchema.parse(raw)
}
