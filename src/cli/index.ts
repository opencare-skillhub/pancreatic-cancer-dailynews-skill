import { pathToFileURL } from 'node:url'
import { loadDependencyCatalog } from '../config/load_dependency_catalog.js'
import { formatDoctorReport, runDoctor, type DoctorArgs } from '../output/doctor.js'
import { formatInstallPlan, resolveInstallPlan } from '../output/install.js'

export type ParsedArgs = DoctorArgs & {
  installSource?: string
}

export function parseArgs(argv: string[]): ParsedArgs {
  let command: string | undefined
  let profile: string | undefined
  let installSource: string | undefined
  let sourcesOnly = false
  let skillsOnly = false
  let fix = false

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

    if (current === 'install-source') {
      command = current
      const value = argv[index + 1]
      if (value && !value.startsWith('--')) {
        installSource = value
        index += 1
      }
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
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)

  if (parsed.command === 'doctor') {
    const catalog = await loadDependencyCatalog()
    const report = await runDoctor(parsed, catalog)
    console.log(formatDoctorReport(report, parsed.fix))
    return
  }

  if (parsed.command === 'install-source') {
    if (!parsed.installSource) {
      throw new Error('install-source requires a source id')
    }
    const catalog = await loadDependencyCatalog()
    const plan = resolveInstallPlan(catalog, parsed.installSource)
    console.log(formatInstallPlan(plan))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
