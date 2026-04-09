import { z } from 'zod'

const commandCheckSchema = z.object({
  kind: z.literal('command'),
  command: z.string().trim().min(1),
})

const fileExistsCheckSchema = z.object({
  kind: z.literal('file_exists'),
  path: z.string().trim().min(1),
})

const skillExistsCheckSchema = z.object({
  kind: z.literal('skill_exists'),
  skill: z.string().trim().min(1),
})

const httpHealthCheckSchema = z.object({
  kind: z.literal('http_health'),
  url: z.string().trim().min(1),
})

export const dependencyCheckSchema = z.discriminatedUnion('kind', [
  commandCheckSchema,
  fileExistsCheckSchema,
  skillExistsCheckSchema,
  httpHealthCheckSchema,
])

export const dependencyInstallSchema = z.object({
  kind: z.enum(['npm', 'github_skill', 'manual', 'git_clone', 'builtin', 'npx']),
  command: z.string().trim().min(1),
})

export const dependencyMetadataSchema = z.object({
  name: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
  repository: z.string().trim().min(1).optional(),
  localPath: z.string().trim().min(1).optional(),
  deploymentStatus: z.string().trim().min(1).optional(),
  deploymentNotes: z.array(z.string().trim().min(1)).optional(),
  installMethods: z.array(z.string().trim().min(1)).optional(),
  apiRequirements: z.array(z.string().trim().min(1)).optional(),
  primaryUseCases: z.array(z.string().trim().min(1)).optional(),
  callableVia: z.array(z.string().trim().min(1)).optional(),
  configPath: z.string().trim().min(1).optional(),
}).optional()

export const dependencyCatalogEntrySchema = z.object({
  type: z.enum(['skill', 'local_cli', 'npm_mcp', 'remote_mcp', 'scripted_install']),
  required: z.boolean(),
  role: z.string().trim().min(1),
  check: dependencyCheckSchema,
  install: dependencyInstallSchema.optional(),
  fallback: z.string().trim().min(1).optional(),
  docs: z.object({
    homepage: z.string().trim().min(1).optional(),
  }).optional(),
  metadata: dependencyMetadataSchema,
})

export const dependencyCatalogSchema = z.record(z.string().trim().min(1), dependencyCatalogEntrySchema)

export type DependencyCatalog = z.infer<typeof dependencyCatalogSchema>
export type DependencyCatalogEntry = z.infer<typeof dependencyCatalogEntrySchema>
export type DependencyCheck = z.infer<typeof dependencyCheckSchema>
