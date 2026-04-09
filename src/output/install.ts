import type { DependencyCatalog, DependencyCatalogEntry } from '../schema/deployment.js'

export type InstallPlan = {
  id: string
  role: string
  command: string
  fallback?: string
  docsUrl?: string
}

export function buildInstallPlan(id: string, entry: DependencyCatalogEntry): InstallPlan {
  if (!entry.install) {
    throw new Error(`No install command configured for ${id}`)
  }

  return {
    id,
    role: entry.role,
    command: entry.install.command,
    fallback: entry.fallback,
    docsUrl: entry.docs?.homepage,
  }
}

export function formatInstallPlan(plan: InstallPlan): string {
  const lines = [
    `Install source: ${plan.id}`,
    `Role: ${plan.role}`,
    `Command: ${plan.command}`,
  ]

  if (plan.fallback) {
    lines.push(`Fallback: ${plan.fallback}`)
  }

  if (plan.docsUrl) {
    lines.push(`Docs: ${plan.docsUrl}`)
  }

  return lines.join('\n')
}

export function resolveInstallPlan(catalog: DependencyCatalog, id: string): InstallPlan {
  const entry = catalog[id]
  if (!entry) {
    throw new Error(`Unknown source dependency: ${id}`)
  }

  return buildInstallPlan(id, entry)
}
