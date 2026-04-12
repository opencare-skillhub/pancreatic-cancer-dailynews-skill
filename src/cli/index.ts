import { createInterface } from 'node:readline/promises'
import { spawn } from 'node:child_process'
import { access, copyFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { loadDependencyCatalog } from '../config/load_dependency_catalog.js'
import { loadSourcesRegistry } from '../config/load_sources_registry.js'
import { formatDoctorReport, runDoctor, type DoctorArgs } from '../output/doctor.js'
import {
  classifyInstallFailure,
  formatConfigGuidance,
  formatInstallQueue,
  formatFailureGuidance,
  formatInstallPlan,
  formatInstallResults,
  resolveInstallPlan,
  sortInstallPlans,
  type InstallPlan,
  type InstallResult,
} from '../output/install.js'
import { formatSyncSourcesResult, syncSources } from '../output/sync_sources.js'

export type ParsedArgs = DoctorArgs & {
  installSource?: string
  yes?: boolean
}

export type CliDeps = {
  confirm?: (prompt: string) => Promise<boolean>
  runInstallCommand?: (command: string) => Promise<InstallResult>
  ensureConfigTemplate?: (plan: InstallPlan) => Promise<string | undefined>
  log?: (message: string) => void
}

export function parseArgs(argv: string[]): ParsedArgs {
  let command: string | undefined
  let profile: string | undefined
  let installSource: string | undefined
  let sourcesOnly = false
  let skillsOnly = false
  let fix = false
  let yes = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--profile') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('--profile requires a value')
      }
      profile = value
      index += 1
      continue
    }

    if (current === '--sources') {
      sourcesOnly = true
      continue
    }

    if (current === '--skills') {
      skillsOnly = true
      continue
    }

    if (current === '--fix') {
      fix = true
      continue
    }

    if (current === '--yes' || current === '-y') {
      yes = true
      continue
    }

    if (current === 'install-source') {
      command = current
      const value = argv[index + 1]
      if (value && !value.startsWith('--')) {
        installSource = value
        index += 1
      }
      continue
    }

    if (current === 'sync-sources') {
      command = current
      continue
    }

    if (current === 'xiaoyibao' || current === 'doctor') {
      command = 'xiaoyibao'
      continue
    }

    if (current.startsWith('--')) {
      continue
    }

    if (!command) {
      command = current
    }
  }

  return {
    command: command ?? 'run',
    profile,
    sourcesOnly,
    skillsOnly,
    fix,
    installSource,
    yes,
  }
}

async function defaultConfirm(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`${prompt} `)
    return /^(y|yes)$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

async function defaultRunInstallCommand(command: string): Promise<InstallResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
    })

    child.on('error', (error) => {
      resolve({
        id: command,
        command,
        success: false,
        exitCode: 1,
        failureKind: classifyInstallFailure(1, error.message),
        errorMessage: error.message,
      })
    })
    child.on('close', (code) => {
      const exitCode = code ?? 1
      const success = exitCode === 0
      resolve({
        id: command,
        command,
        success,
        exitCode,
        failureKind: success ? undefined : classifyInstallFailure(exitCode),
      })
    })
  })
}

async function defaultEnsureConfigTemplate(plan: InstallPlan): Promise<string | undefined> {
  if (!plan.configPath) {
    return undefined
  }

  const examplePath = plan.configPath.replace(/\.local$/, '.example')
  try {
    await access(plan.configPath)
    return `Config file already exists: ${plan.configPath}`
  } catch {
    // continue
  }

  try {
    await access(examplePath)
    await copyFile(examplePath, plan.configPath)
    return `Created config file from template: ${plan.configPath}`
  } catch {
    return `Remember to create config file: ${plan.configPath}`
  }
}

function resolvePendingPlans(catalog: Awaited<ReturnType<typeof loadDependencyCatalog>>, report: Awaited<ReturnType<typeof runDoctor>>): InstallPlan[] {
  const plans = report.items
    .filter((item) => item.status !== 'ready' && catalog[item.id]?.install)
    .map((item) => resolveInstallPlan(catalog, item.id))

  return sortInstallPlans(plans)
}

export async function main(argv = process.argv.slice(2), deps: CliDeps = {}): Promise<void> {
  const parsed = parseArgs(argv)
  const log = deps.log ?? console.log

  if (parsed.command === 'xiaoyibao') {
    const catalog = await loadDependencyCatalog()
    const report = await runDoctor(parsed, catalog)
    log(formatDoctorReport(report, parsed.fix))

    if (!parsed.fix || report.pendingActions.length === 0) {
      return
    }

    const plans = resolvePendingPlans(catalog, report)
    if (plans.length > 0) {
      log('')
      log(formatInstallQueue(plans))
    }
    const confirmed = parsed.yes || await (deps.confirm ?? defaultConfirm)('Continue? [y/N]')
    if (!confirmed) {
      log('Installation cancelled.')
      return
    }

    const runInstallCommand = deps.runInstallCommand ?? defaultRunInstallCommand
    const ensureConfigTemplate = deps.ensureConfigTemplate ?? defaultEnsureConfigTemplate
    const results: InstallResult[] = []
    const configMessages: string[] = []
    for (const plan of plans) {
      const result = await runInstallCommand(plan.command)
      results.push({ ...result, id: plan.id, command: plan.command })
      if (result.success) {
        const configMessage = await ensureConfigTemplate(plan)
        if (configMessage) {
          configMessages.push(`- ${plan.id}: ${configMessage}`)
        }
      }
    }

    log('')
    log(formatInstallResults(results))

    const failureGuidance = formatFailureGuidance(results)
    if (failureGuidance) {
      log('')
      log(failureGuidance)
    }

    const guidance = formatConfigGuidance(plans)
    if (guidance) {
      log('')
      log(guidance)
    }
    if (configMessages.length > 0) {
      log('')
      log(['Config file actions:', ...configMessages].join('\n'))
    }
    return
  }

  if (parsed.command === 'install-source') {
    if (!parsed.installSource) {
      throw new Error('install-source requires a source id')
    }
    const catalog = await loadDependencyCatalog()
    const plan = resolveInstallPlan(catalog, parsed.installSource)
    log(formatInstallPlan(plan))
  }

  if (parsed.command === 'sync-sources') {
    const registry = await loadSourcesRegistry()
    const result = await syncSources(process.cwd(), registry)
    log(formatSyncSourcesResult(result))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
