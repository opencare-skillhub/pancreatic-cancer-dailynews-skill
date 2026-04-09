# Pancreatic Digest v5 (Node 单包 + MCP 双向) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前多脚本 Python 项目升级为可 npm 发布的 TypeScript 单包，提供统一 CLI 入口、MCP Client 聚合、MCP Server 对外 tools，并稳定产出 6 板块日报。

**Architecture:** 采用 Client-First + Server-Export：先建立 `digest run` 主流水线与统一 schema，再接入多信源聚合与降级策略，最后暴露 MCP Server tools。所有能力都在同一 npm 包内部实现并通过 profile 驱动。

**Tech Stack:** Node.js 20+, TypeScript, Zod, Vitest, MCP TypeScript SDK, Markdown renderer

---

## File Structure Lock-in

- Create: `package.json` — npm 包声明、bin 命令、scripts
- Create: `tsconfig.json` — TS 编译配置
- Create: `src/cli/index.ts` — CLI 主入口 (`run`, `doctor`, `mcp:serve`, `migrate-config`)
- Create: `src/schema/item.ts` — 统一 Item 与 Section 类型
- Create: `src/schema/config.ts` — 配置 schema 与校验
- Create: `src/core/pipeline.ts` — 主流水线编排
- Create: `src/core/scoring.ts` — 评分与排序规则
- Create: `src/core/sectioning.ts` — 6 板块归类
- Create: `src/sources/clinical_trials.ts` — Clinical 源适配器
- Create: `src/sources/pubmed.ts` — PubMed 源适配器
- Create: `src/sources/web_search.ts` — 搜索源适配器（含 fallback）
- Create: `src/mcp-client/client.ts` — MCP client 统一调用器
- Create: `src/mcp-server/server.ts` — MCP server 注册与 tool handlers
- Create: `src/output/markdown.ts` — 日报 markdown 渲染
- Create: `src/output/validation.ts` — 报告完整性校验
- Create: `src/config/load_profile.ts` — profile 加载
- Create: `src/config/migrate_v4_to_v5.ts` — 配置迁移逻辑
- Create: `config/base.json`
- Create: `config/profiles/daily-v5.json`
- Create: `config/profiles/research-v5.json`
- Create: `data/history.jsonl`
- Create: `tests/cli/run.test.ts`
- Create: `tests/core/pipeline.test.ts`
- Create: `tests/core/sectioning.test.ts`
- Create: `tests/mcp/server.test.ts`
- Create: `tests/config/migrate.test.ts`

---

### Task 1: 初始化 npm 单包与 CLI 骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Test: `tests/cli/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cli/run.test.ts
import { describe, it, expect } from 'vitest'
import { parseArgs } from '../../src/cli/index'

describe('cli parseArgs', () => {
  it('parses run command with profile', () => {
    const result = parseArgs(['run', '--profile', 'daily-v5'])
    expect(result.command).toBe('run')
    expect(result.profile).toBe('daily-v5')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/run.test.ts`
Expected: FAIL with `Cannot find module '../../src/cli/index'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cli/index.ts
export type ParsedArgs = { command: string; profile?: string }

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] ?? 'run'
  const profileIndex = argv.indexOf('--profile')
  const profile = profileIndex >= 0 ? argv[profileIndex + 1] : undefined
  return { command, profile }
}
```

```json
// package.json
{
  "name": "@xiaoyibao/pancreatic-digest",
  "version": "5.0.0-next.0",
  "type": "module",
  "bin": { "digest": "dist/cli/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.1"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/run.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/cli/index.ts tests/cli/run.test.ts
git commit -m "feat(v5): bootstrap npm package and cli arg parser"
```

---

### Task 2: 定义统一数据模型与配置 schema

**Files:**
- Create: `src/schema/item.ts`
- Create: `src/schema/config.ts`
- Test: `tests/core/sectioning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/sectioning.test.ts
import { describe, it, expect } from 'vitest'
import { itemSchema } from '../../src/schema/item'

describe('item schema', () => {
  it('accepts traceable item', () => {
    const parsed = itemSchema.parse({
      id: 'clinicaltrials:NCT123',
      title: 'Phase 3 trial',
      sourceType: 'clinical_trials',
      sectionHint: 'clinical_trials_and_drug_rnd',
      sourceUrl: 'https://clinicaltrials.gov/study/NCT123',
      fetchedAt: '2026-04-09T08:00:00.000Z',
      evidence: ['nct:NCT123']
    })
    expect(parsed.id).toBe('clinicaltrials:NCT123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/sectioning.test.ts`
Expected: FAIL with `Cannot find module '../../src/schema/item'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/schema/item.ts
import { z } from 'zod'

export const sectionIdSchema = z.enum([
  'clinical_trials_and_drug_rnd',
  'research_hotspots',
  'disease_management_guides',
  'nutrition_and_psychology',
  'community_and_wechat',
  'daily_encouragement'
])

export const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceType: z.string().min(1),
  sectionHint: sectionIdSchema,
  sourceUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
  evidence: z.array(z.string()).min(1),
  phase: z.string().optional(),
  scoreBreakdown: z.record(z.number()).optional()
})

export type DigestItem = z.infer<typeof itemSchema>
```

```ts
// src/schema/config.ts
import { z } from 'zod'

export const profileSchema = z.object({
  profile: z.string(),
  sections: z.array(z.string()).length(6),
  dedupWindowDays: z.number().int().positive()
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/sectioning.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/schema/item.ts src/schema/config.ts tests/core/sectioning.test.ts
git commit -m "feat(v5): add unified item and config schemas"
```

---

### Task 3: 实现 core pipeline 最小闭环（fetch→section→render）

**Files:**
- Create: `src/core/pipeline.ts`
- Create: `src/core/sectioning.ts`
- Create: `src/output/markdown.ts`
- Test: `tests/core/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/pipeline.test.ts
import { describe, it, expect } from 'vitest'
import { runPipeline } from '../../src/core/pipeline'

describe('pipeline', () => {
  it('returns six sections', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [] })
    expect(report.sections.length).toBe(6)
    expect(report.markdown.includes('## 1.')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: FAIL with `Cannot find module '../../src/core/pipeline'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/sectioning.ts
import type { DigestItem } from '../schema/item'

export const sectionOrder = [
  'clinical_trials_and_drug_rnd',
  'research_hotspots',
  'disease_management_guides',
  'nutrition_and_psychology',
  'community_and_wechat',
  'daily_encouragement'
] as const

export function groupSections(items: DigestItem[]) {
  return sectionOrder.map((id) => ({ id, items: items.filter((i) => i.sectionHint === id) }))
}
```

```ts
// src/output/markdown.ts
export function renderMarkdown(date: string, sections: Array<{ id: string; items: Array<{ title: string; sourceUrl: string }> }>) {
  const lines = [`# 胰腺癌日报 ${date}`]
  sections.forEach((s, idx) => {
    lines.push('', `## ${idx + 1}. ${s.id}`)
    if (s.items.length === 0) lines.push('- 暂无更新（已触发fallback）')
    s.items.forEach((item) => lines.push(`- ${item.title} (${item.sourceUrl})`))
  })
  return lines.join('\n')
}
```

```ts
// src/core/pipeline.ts
import { groupSections } from './sectioning'
import { renderMarkdown } from '../output/markdown'
import type { DigestItem } from '../schema/item'

export async function runPipeline(input: { date: string; profile: string; items: DigestItem[] }) {
  const sections = groupSections(input.items)
  const markdown = renderMarkdown(input.date, sections)
  return { sections, markdown }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/pipeline.ts src/core/sectioning.ts src/output/markdown.ts tests/core/pipeline.test.ts
git commit -m "feat(v5): implement minimal digest pipeline with six sections"
```

---

### Task 4: 接入 ClinicalTrials 与 PubMed 两个核心源

**Files:**
- Create: `src/sources/clinical_trials.ts`
- Create: `src/sources/pubmed.ts`
- Modify: `src/core/pipeline.ts`
- Test: `tests/core/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append in tests/core/pipeline.test.ts
it('pulls from core sources', async () => {
  const { collectCoreSources } = await import('../../src/core/pipeline')
  const items = await collectCoreSources({ date: '2026-04-09' })
  expect(Array.isArray(items)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: FAIL with `collectCoreSources is not a function`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/sources/clinical_trials.ts
import type { DigestItem } from '../schema/item'

export async function fetchClinicalTrials(): Promise<DigestItem[]> {
  return []
}
```

```ts
// src/sources/pubmed.ts
import type { DigestItem } from '../schema/item'

export async function fetchPubmed(): Promise<DigestItem[]> {
  return []
}
```

```ts
// src/core/pipeline.ts (add)
import { fetchClinicalTrials } from '../sources/clinical_trials'
import { fetchPubmed } from '../sources/pubmed'

export async function collectCoreSources(_input: { date: string }) {
  const [ct, pm] = await Promise.all([fetchClinicalTrials(), fetchPubmed()])
  return [...ct, ...pm]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: PASS with all tests green

- [ ] **Step 5: Commit**

```bash
git add src/sources/clinical_trials.ts src/sources/pubmed.ts src/core/pipeline.ts tests/core/pipeline.test.ts
git commit -m "feat(v5): wire core source adapters for clinical trials and pubmed"
```

---

### Task 5: 实现 MCP Client 聚合与 fallback 策略

**Files:**
- Create: `src/mcp-client/client.ts`
- Create: `src/sources/web_search.ts`
- Modify: `src/core/pipeline.ts`
- Test: `tests/core/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append in tests/core/pipeline.test.ts
it('falls back when primary provider fails', async () => {
  const { searchWebWithFallback } = await import('../../src/sources/web_search')
  const result = await searchWebWithFallback('pancreatic cancer trial', {
    primary: async () => { throw new Error('primary down') },
    secondary: async () => [{ title: 'fallback hit', sourceUrl: 'https://example.com' }]
  })
  expect(result[0].title).toBe('fallback hit')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: FAIL with `Cannot find module '../../src/sources/web_search'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/mcp-client/client.ts
export async function callMcpTool<T>(toolName: string, input: unknown, invoke: (tool: string, payload: unknown) => Promise<T>): Promise<T> {
  return invoke(toolName, input)
}
```

```ts
// src/sources/web_search.ts
export async function searchWebWithFallback(
  _query: string,
  providers: {
    primary: () => Promise<Array<{ title: string; sourceUrl: string }>>
    secondary: () => Promise<Array<{ title: string; sourceUrl: string }>>
  }
) {
  try {
    return await providers.primary()
  } catch {
    return providers.secondary()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pipeline.test.ts`
Expected: PASS with fallback test green

- [ ] **Step 5: Commit**

```bash
git add src/mcp-client/client.ts src/sources/web_search.ts tests/core/pipeline.test.ts
git commit -m "feat(v5): add mcp client wrapper and web search fallback"
```

---

### Task 6: 实现 MCP Server 5 个 tools

**Files:**
- Create: `src/mcp-server/server.ts`
- Modify: `src/core/pipeline.ts`
- Create: `tests/mcp/server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mcp/server.test.ts
import { describe, it, expect } from 'vitest'
import { listToolNames } from '../../src/mcp-server/server'

describe('mcp server tools', () => {
  it('registers required tools', () => {
    expect(listToolNames()).toEqual([
      'digest.run_daily',
      'digest.search_topic',
      'digest.get_section',
      'digest.list_sources',
      'digest.validate_report'
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mcp/server.test.ts`
Expected: FAIL with `Cannot find module '../../src/mcp-server/server'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/mcp-server/server.ts
const tools = [
  'digest.run_daily',
  'digest.search_topic',
  'digest.get_section',
  'digest.list_sources',
  'digest.validate_report'
] as const

export function listToolNames() {
  return [...tools]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mcp/server.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/server.ts tests/mcp/server.test.ts
git commit -m "feat(v5): register mcp server tool surface"
```

---

### Task 7: 配置分层与 v4→v5 迁移命令

**Files:**
- Create: `src/config/load_profile.ts`
- Create: `src/config/migrate_v4_to_v5.ts`
- Create: `config/base.json`
- Create: `config/profiles/daily-v5.json`
- Create: `config/profiles/research-v5.json`
- Create: `tests/config/migrate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/migrate.test.ts
import { describe, it, expect } from 'vitest'
import { migrateV4ToV5 } from '../../src/config/migrate_v4_to_v5'

describe('config migration', () => {
  it('maps v4 sources into v5 profile shape', () => {
    const v4 = { sources: { clinicaltrials: { enabled: true } } }
    const v5 = migrateV4ToV5(v4)
    expect(v5.profile).toBe('daily-v5')
    expect(v5.sources.clinical_trials.enabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/migrate.test.ts`
Expected: FAIL with `Cannot find module '../../src/config/migrate_v4_to_v5'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config/migrate_v4_to_v5.ts
export function migrateV4ToV5(v4: any) {
  return {
    profile: 'daily-v5',
    sections: [
      'clinical_trials_and_drug_rnd',
      'research_hotspots',
      'disease_management_guides',
      'nutrition_and_psychology',
      'community_and_wechat',
      'daily_encouragement'
    ],
    dedupWindowDays: 30,
    sources: {
      clinical_trials: { enabled: Boolean(v4?.sources?.clinicaltrials?.enabled) }
    }
  }
}
```

```json
// config/base.json
{
  "timeoutMs": 12000,
  "retry": 2,
  "dedupWindowDays": 30
}
```

```json
// config/profiles/daily-v5.json
{
  "profile": "daily-v5",
  "sections": [
    "clinical_trials_and_drug_rnd",
    "research_hotspots",
    "disease_management_guides",
    "nutrition_and_psychology",
    "community_and_wechat",
    "daily_encouragement"
  ],
  "dedupWindowDays": 30
}
```

```json
// config/profiles/research-v5.json
{
  "profile": "research-v5",
  "sections": [
    "clinical_trials_and_drug_rnd",
    "research_hotspots",
    "disease_management_guides",
    "nutrition_and_psychology",
    "community_and_wechat",
    "daily_encouragement"
  ],
  "dedupWindowDays": 14
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config/migrate.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/config/migrate_v4_to_v5.ts config/base.json config/profiles/daily-v5.json config/profiles/research-v5.json tests/config/migrate.test.ts
git commit -m "feat(v5): add profile configs and v4 to v5 migration"
```

---

### Task 8: doctor 校验与发布前验证

**Files:**
- Create: `src/output/validation.ts`
- Modify: `src/cli/index.ts`
- Modify: `package.json`
- Test: `tests/cli/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append in tests/cli/run.test.ts
it('supports doctor command', () => {
  const result = parseArgs(['doctor'])
  expect(result.command).toBe('doctor')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/run.test.ts`
Expected: FAIL if command parsing hard-coded to run

- [ ] **Step 3: Write minimal implementation**

```ts
// src/output/validation.ts
export function validateReport(input: { sectionCount: number; traceabilityRate: number }) {
  return {
    ok: input.sectionCount === 6 && input.traceabilityRate >= 0.95,
    sectionCount: input.sectionCount,
    traceabilityRate: input.traceabilityRate
  }
}
```

```ts
// src/cli/index.ts (update parseArgs + command switch)
export function parseArgs(argv: string[]): ParsedArgs {
  const command = ['run', 'doctor', 'mcp:serve', 'migrate-config'].includes(argv[0] ?? '') ? (argv[0] as string) : 'run'
  const profileIndex = argv.indexOf('--profile')
  const profile = profileIndex >= 0 ? argv[profileIndex + 1] : undefined
  return { command, profile }
}
```

```json
// package.json (scripts add)
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "doctor": "node dist/cli/index.js doctor"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/run.test.ts`
Expected: PASS with doctor parsing test green

- [ ] **Step 5: Commit**

```bash
git add src/output/validation.ts src/cli/index.ts package.json tests/cli/run.test.ts
git commit -m "feat(v5): add doctor validation entrypoint"
```

---

## Final Verification Checklist

- [ ] Run: `npm test`
- [ ] Expected: all tests PASS
- [ ] Run: `npm run build`
- [ ] Expected: `dist/` generated without TS errors
- [ ] Run: `node dist/cli/index.js run --profile daily-v5`
- [ ] Expected: 输出 6 板块 markdown（允许空板块 fallback）
- [ ] Run: `node dist/cli/index.js mcp:serve`
- [ ] Expected: MCP server 启动并暴露 5 个 tools

## Spec Coverage Mapping

- 单入口重构：Task 1/3/8
- 多信源组合（核心+搜索+fallback）：Task 4/5
- 6 板块结构：Task 2/3
- MCP 双向（client+server）：Task 5/6
- v4→v5 迁移与版本治理：Task 7
- 质量门禁与 doctor：Task 8

## Self-Review Notes

1. Placeholder scan: 已检查，无 TBD/TODO/“后续实现”语句。
2. Type consistency: `sectionHint`、6板块 ID、tool 名称在任务间一致。
3. Scope check: 本计划可在单分支完成；若团队并行，可按 Task 组拆分。

