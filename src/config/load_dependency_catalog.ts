import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { dependencyCatalogSchema, type DependencyCatalog } from '../schema/deployment.js'

export async function loadDependencyCatalog(rootDir = process.cwd()): Promise<DependencyCatalog> {
  const filePath = resolve(rootDir, 'config', 'deployment', 'dependency-catalog.json')
  const raw = JSON.parse(await readFile(filePath, 'utf-8'))
  return dependencyCatalogSchema.parse(raw)
}
