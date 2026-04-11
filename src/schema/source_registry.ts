import { z } from 'zod'
import { dependencyCheckSchema, dependencyInstallSchema } from './deployment.js'

const sourceRegistryConfigSchema = z.object({
  file: z.string().trim().min(1).optional(),
  vars: z.array(z.string().trim().min(1)).default([]),
  exampleValues: z.record(z.string(), z.string()).default({}),
}).optional()

const sourceRegistryMcpSchema = z.object({
  command: z.string().trim().min(1),
  args: z.array(z.string().trim().min(1)).default([]),
}).optional()

export const sourceRegistryEntrySchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(['skill', 'local_cli', 'npm_mcp', 'remote_mcp', 'scripted_install']),
  required: z.boolean().default(false),
  enabled: z.boolean().default(true),
  role: z.string().trim().min(1),
  check: dependencyCheckSchema,
  install: dependencyInstallSchema.optional(),
  fallback: z.string().trim().min(1).optional(),
  docs: z.object({
    homepage: z.string().trim().min(1).optional(),
  }).optional(),
  metadata: z.object({
    name: z.string().trim().min(1).optional(),
    version: z.string().trim().min(1).optional(),
    repository: z.string().trim().min(1).optional(),
    localPath: z.string().trim().min(1).optional(),
    deploymentStatus: z.string().trim().min(1).optional(),
    deploymentNotes: z.array(z.string().trim().min(1)).optional(),
    installMethods: z.array(z.string().trim().min(1)).optional(),
    primaryUseCases: z.array(z.string().trim().min(1)).optional(),
    callableVia: z.array(z.string().trim().min(1)).optional(),
  }).default({}),
  config: sourceRegistryConfigSchema,
  mcp: sourceRegistryMcpSchema,
})

export const sourceRegistrySchema = z.object({
  sources: z.array(sourceRegistryEntrySchema),
})

export type SourceRegistry = z.infer<typeof sourceRegistrySchema>
export type SourceRegistryEntry = z.infer<typeof sourceRegistryEntrySchema>
