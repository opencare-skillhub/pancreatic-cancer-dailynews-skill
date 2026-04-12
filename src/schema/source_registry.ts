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

const sourceRegistryAbilitiesSchema = z.object({
  search: z.object({
    enabled: z.boolean().default(true),
    adapter: z.enum(['pubmed_eutils', 'openclaw_grok_compatible', 'tavily_http', 'mcp_tool', 'skill_cli']),
    tool: z.string().trim().min(1).optional(),
    endpoint: z.string().trim().min(1).optional(),
    command: z.string().trim().min(1).optional(),
  }).optional(),
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
  abilities: sourceRegistryAbilitiesSchema,
}).superRefine((entry, ctx) => {
  const search = entry.abilities?.search
  if (!search?.enabled) return

  if (search.adapter === 'mcp_tool' && !['npm_mcp', 'remote_mcp'].includes(entry.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `source ${entry.id}: mcp_tool adapter requires type npm_mcp or remote_mcp`,
      path: ['abilities', 'search', 'adapter'],
    })
  }

  if (search.adapter === 'skill_cli' && entry.type !== 'skill') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `source ${entry.id}: skill_cli adapter requires type skill`,
      path: ['abilities', 'search', 'adapter'],
    })
  }

  if (search.adapter === 'mcp_tool' && !search.tool) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `source ${entry.id}: mcp_tool adapter requires tool`,
      path: ['abilities', 'search', 'tool'],
    })
  }

  if (search.adapter === 'skill_cli' && !search.command) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `source ${entry.id}: skill_cli adapter requires command`,
      path: ['abilities', 'search', 'command'],
    })
  }
})

export const sourceRegistrySchema = z.object({
  sources: z.array(sourceRegistryEntrySchema),
})

export type SourceRegistry = z.infer<typeof sourceRegistrySchema>
export type SourceRegistryEntry = z.infer<typeof sourceRegistryEntrySchema>
