import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { DependencyCatalog } from '../schema/deployment.js'
import type { SourceRegistry, SourceRegistryEntry } from '../schema/source_registry.js'

export type SyncSourcesResult = {
  catalogPath: string
  envFiles: string[]
  readmePath: string
  generatedCount: number
}

function toCatalogEntry(entry: SourceRegistryEntry): DependencyCatalog[string] {
  return {
    type: entry.type,
    required: entry.required,
    role: entry.role,
    check: entry.check,
    install: entry.install,
    fallback: entry.fallback,
    docs: entry.docs,
    metadata: {
      ...entry.metadata,
      configPath: entry.config?.file,
      apiRequirements: entry.config?.vars ?? [],
      ...(entry.mcp
        ? {
            callableVia: [
              ...(entry.metadata.callableVia ?? []),
              JSON.stringify({
                command: entry.mcp.command,
                args: entry.mcp.args,
              }),
            ],
          }
        : {}),
    },
  }
}

export function buildDependencyCatalog(registry: SourceRegistry): DependencyCatalog {
  return Object.fromEntries(
    registry.sources
      .filter((entry) => entry.enabled)
      .map((entry) => [entry.id, toCatalogEntry(entry)]),
  )
}

export function buildEnvExampleContent(entry: SourceRegistryEntry): string {
  const vars = entry.config?.vars ?? []
  if (vars.length === 0) {
    return ''
  }

  const lines = [`# ${entry.id}`]
  for (const variable of vars) {
    const value = entry.config?.exampleValues?.[variable] ?? `replace-${variable.toLowerCase()}`
    lines.push(`${variable}=${value}`)
  }
  return `${lines.join('\n')}\n`
}

function isProjectLocalConfigFile(path: string): boolean {
  return !path.startsWith('~') && !path.startsWith('/')
}

export function buildReadmeGeneratedBlock(registry: SourceRegistry): string {
  const lines = [
    '<!-- generated:sources:start -->',
    '## 🔌 Sources Registry（自动生成）',
    '',
    '以下内容由 `digest sync-sources` 从 `config/sources.registry.yaml` 自动生成。',
    '',
    '| ID | 类型 | 角色 | 安装 | 配置文件 |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const entry of registry.sources.filter((item) => item.enabled)) {
    lines.push(
      `| ${entry.id} | ${entry.type} | ${entry.role} | ${entry.install?.command ?? 'manual'} | ${entry.config?.file ?? '-'} |`,
    )
  }

  lines.push('', '### 使用方式', '', '1. 修改 `config/sources.registry.yaml`', '2. 运行 `digest sync-sources`', '3. 自动更新 deployment catalog / `.env.*.example` / README', '<!-- generated:sources:end -->')
  return lines.join('\n')
}

export async function updateReadmeGeneratedBlock(rootDir: string, block: string): Promise<string> {
  const readmePath = resolve(rootDir, 'README.md')
  const content = await readFile(readmePath, 'utf-8')
  const start = '<!-- generated:sources:start -->'
  const end = '<!-- generated:sources:end -->'

  const updated = content.includes(start) && content.includes(end)
    ? content.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block)
    : `${content.trimEnd()}\n\n---\n\n${block}\n`

  await writeFile(readmePath, updated)
  return readmePath
}

export async function syncSources(rootDir: string, registry: SourceRegistry): Promise<SyncSourcesResult> {
  const catalog = buildDependencyCatalog(registry)
  const catalogPath = resolve(rootDir, 'config', 'deployment', 'dependency-catalog.json')
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)

  const envFiles: string[] = []
  for (const entry of registry.sources) {
    if (
      !entry.enabled
      || !entry.config?.file
      || !isProjectLocalConfigFile(entry.config.file)
      || (entry.config.vars?.length ?? 0) === 0
    ) {
      continue
    }

    const examplePath = resolve(rootDir, entry.config.file.replace(/\.local$/, '.example'))
    await mkdir(dirname(examplePath), { recursive: true })
    await writeFile(examplePath, buildEnvExampleContent(entry))
    envFiles.push(examplePath)
  }

  const readmePath = await updateReadmeGeneratedBlock(rootDir, buildReadmeGeneratedBlock(registry))
  return {
    catalogPath,
    envFiles,
    readmePath,
    generatedCount: Object.keys(catalog).length,
  }
}

export function formatSyncSourcesResult(result: SyncSourcesResult): string {
  const lines = [
    'sync-sources completed.',
    `Catalog: ${result.catalogPath}`,
    `README: ${result.readmePath}`,
    `Entries: ${result.generatedCount}`,
  ]

  if (result.envFiles.length > 0) {
    lines.push('Env examples:')
    result.envFiles.forEach((file) => lines.push(`- ${file}`))
  }

  return lines.join('\n')
}
