import { describe, expect, it } from 'vitest'
import { runPipeline } from '../../src/core/pipeline.js'

describe('pipeline', () => {
  it('returns six sections and markdown with numbering', async () => {
    const report = await runPipeline({ date: '2026-04-09', profile: 'daily-v5', items: [] })

    expect(report.sections.length).toBe(6)
    expect(report.markdown.includes('## 1.')).toBe(true)
  })
})
