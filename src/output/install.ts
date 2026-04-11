import type { DependencyCatalog, DependencyCatalogEntry } from '../schema/deployment.js'

export type InstallPlan = {
  id: string
  role: string
  command: string
  type: DependencyCatalogEntry['type']
  installKind: NonNullable<DependencyCatalogEntry['install']>['kind']
  fallback?: string
  docsUrl?: string
  configPath?: string
  apiRequirements?: string[]
}

export type InstallResult = {
  id: string
  command: string
  success: boolean
  exitCode: number
  failureKind?: 'command_not_found' | 'network_or_registry' | 'permission' | 'unknown'
  errorMessage?: string
}

export function buildInstallPlan(id: string, entry: DependencyCatalogEntry): InstallPlan {
  if (!entry.install) {
    throw new Error(`No install command configured for ${id}`)
  }

  return {
    id,
    role: entry.role,
    command: entry.install.command,
    type: entry.type,
    installKind: entry.install.kind,
    fallback: entry.fallback,
    docsUrl: entry.docs?.homepage,
    configPath: entry.metadata?.configPath,
    apiRequirements: entry.metadata?.apiRequirements,
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

export function formatConfigGuidance(plans: InstallPlan[]): string {
  const relevantPlans = plans.filter((plan) => plan.configPath || (plan.apiRequirements?.length ?? 0) > 0)
  if (relevantPlans.length === 0) {
    return ''
  }

  const lines = ['Configuration reminders:']
  for (const plan of relevantPlans) {
    lines.push(`- ${plan.id}`)
    if (plan.configPath) {
      lines.push(`  Config file: ${plan.configPath}`)
    }
    if (plan.apiRequirements && plan.apiRequirements.length > 0) {
      lines.push(`  Variables: ${plan.apiRequirements.join('; ')}`)
    }
  }

  return lines.join('\n')
}

const planTypeOrder: Record<InstallPlan['type'], number> = {
  skill: 1,
  npm_mcp: 2,
  remote_mcp: 3,
  local_cli: 4,
  scripted_install: 5,
}

export function sortInstallPlans(plans: InstallPlan[]): InstallPlan[] {
  return [...plans].sort((left, right) => {
    const typeDiff = planTypeOrder[left.type] - planTypeOrder[right.type]
    if (typeDiff !== 0) {
      return typeDiff
    }

    return left.id.localeCompare(right.id)
  })
}

export function formatInstallQueue(plans: InstallPlan[]): string {
  if (plans.length === 0) {
    return ''
  }

  const lines = ['Install queue:']
  plans.forEach((plan, index) => {
    lines.push(`${index + 1}. ${plan.id} [${plan.type}/${plan.installKind}]`)
  })
  return lines.join('\n')
}

export function formatInstallResults(results: InstallResult[]): string {
  const lines = ['Install results:']
  for (const result of results) {
    const detail = result.success
      ? `- ${result.id}: OK (exit ${result.exitCode})`
      : `- ${result.id}: FAILED (exit ${result.exitCode})${result.failureKind ? ` [${result.failureKind}]` : ''}`
    lines.push(detail)
    if (!result.success && result.errorMessage) {
      lines.push(`  Reason: ${result.errorMessage}`)
    }
  }

  return lines.join('\n')
}

export function classifyInstallFailure(exitCode: number, errorMessage?: string): InstallResult['failureKind'] {
  const message = errorMessage?.toLowerCase() ?? ''

  if (exitCode === 127 || message.includes('not found') || message.includes('enoent')) {
    return 'command_not_found'
  }
  if (
    message.includes('eacces')
    || message.includes('permission denied')
  ) {
    return 'permission'
  }
  if (
    message.includes('network')
    || message.includes('eai_again')
    || message.includes('enotfound')
    || message.includes('timeout')
    || message.includes('registry')
    || message.includes('fetch failed')
  ) {
    return 'network_or_registry'
  }

  return 'unknown'
}

export function formatFailureGuidance(results: InstallResult[]): string {
  const failed = results.filter((result) => !result.success)
  if (failed.length === 0) {
    return ''
  }

  const lines = ['Failure hints:']
  for (const result of failed) {
    const hint = result.failureKind === 'command_not_found'
      ? '检查本机是否已安装对应命令，或确认 PATH / npx / npm / git 可用。'
      : result.failureKind === 'permission'
        ? '检查文件权限、全局安装权限，必要时改为本地安装或提升权限后重试。'
        : result.failureKind === 'network_or_registry'
          ? '检查网络、npm registry、GitHub 可达性，确认代理或镜像源配置。'
          : '查看上一段安装日志，确认报错细节后再重试。'
    lines.push(`- ${result.id}: ${hint}`)
  }

  return lines.join('\n')
}
