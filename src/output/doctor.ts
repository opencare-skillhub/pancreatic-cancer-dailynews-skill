import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { DependencyCatalog, DependencyCatalogEntry, DependencyCheck } from '../schema/deployment.js'

const execFileAsync = promisify(execFile)

export type DoctorStatus = 'ready' | 'missing' | 'degraded' | 'disabled' | 'remote_unreachable'

export type DoctorArgs = {
  command: string
  profile?: string
  sourcesOnly?: boolean
  skillsOnly?: boolean
  fix?: boolean
}

export type DoctorItem = {
  id: string
  status: DoctorStatus
  summary: string
  kind: 'environment' | 'source' | 'skill'
  installCommand?: string
}

export type DoctorReport = {
  items: DoctorItem[]
  pendingActions: string[]
}

export type DoctorDeps = {
  commandExists?: (command: string) => Promise<boolean>
  fileExists?: (path: string) => Promise<boolean>
  skillExists?: (skill: string) => Promise<boolean>
  httpHealth?: (url: string) => Promise<boolean>
}

async function defaultCommandExists(command: string): Promise<boolean> {
  const [binary, ...args] = command.split(/\s+/)
  try {
    await execFileAsync(binary, args)
    return true
  } catch {
    return false
  }
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function defaultSkillExists(skill: string): Promise<boolean> {
  const pathCandidates = [
    `${process.env.HOME ?? ''}/.agents/skills/${skill}`,
    `${process.env.HOME ?? ''}/.codex/skills/${skill}`,
  ].filter(Boolean)

  for (const path of pathCandidates) {
    if (await defaultFileExists(path)) {
      return true
    }
  }

  return false
}

async function defaultHttpHealth(_url: string): Promise<boolean> {
  return false
}

export async function checkDependencyEntry(
  id: string,
  entry: DependencyCatalogEntry,
  deps: DoctorDeps = {},
): Promise<DoctorItem> {
  const commandExists = deps.commandExists ?? defaultCommandExists
  const fileExists = deps.fileExists ?? defaultFileExists
  const skillExists = deps.skillExists ?? defaultSkillExists
  const httpHealth = deps.httpHealth ?? defaultHttpHealth

  let ok = false
  const check = entry.check as DependencyCheck
  if (check.kind === 'command') {
    ok = await commandExists(check.command)
  } else if (check.kind === 'file_exists') {
    ok = await fileExists(check.path)
  } else if (check.kind === 'skill_exists') {
    ok = await skillExists(check.skill)
  } else if (check.kind === 'http_health') {
    ok = await httpHealth(check.url)
  }

  const kind = entry.type === 'skill' ? 'skill' : 'source'
  return {
    id,
    kind,
    status: ok ? 'ready' : 'missing',
    summary: ok ? `${id} is available` : `${id} is missing`,
    installCommand: entry.install?.command,
  }
}

export async function runDoctor(
  args: DoctorArgs,
  catalog: DependencyCatalog,
  deps: DoctorDeps = {},
): Promise<DoctorReport> {
  const envItems: DoctorItem[] = []
  if (!args.skillsOnly) {
    const commandExists = deps.commandExists ?? defaultCommandExists
    for (const command of ['node --version', 'npm --version', 'npx --version']) {
      const ok = await commandExists(command)
      envItems.push({
        id: command.split(' ')[0],
        kind: 'environment',
        status: ok ? 'ready' : 'missing',
        summary: ok ? `${command.split(' ')[0]} runtime ready` : `${command.split(' ')[0]} runtime missing`,
      })
    }
  }

  const entries = Object.entries(catalog).filter(([, entry]) => {
    if (args.skillsOnly) return entry.type === 'skill'
    if (args.sourcesOnly) return entry.type !== 'skill'
    return true
  })

  const dependencyItems = await Promise.all(entries.map(([id, entry]) => checkDependencyEntry(id, entry, deps)))
  const items = [...envItems, ...dependencyItems]
  const pendingActions = items
    .filter((item) => item.status !== 'ready' && item.installCommand)
    .map((item) => `Install ${item.id}: ${item.installCommand}`)

  return { items, pendingActions }
}

export function formatDoctorReport(report: DoctorReport, fixMode = false): string {
  const lines = report.items.map((item) => `[${item.status.toUpperCase()}] ${item.id} - ${item.summary}`)

  if (report.pendingActions.length > 0) {
    lines.push('', 'Pending actions:')
    report.pendingActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`)
    })
    if (fixMode) {
      lines.push('', 'Continue? [y/N]')
    }
  }

  return lines.join('\n')
}
