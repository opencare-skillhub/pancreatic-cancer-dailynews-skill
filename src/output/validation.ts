export function validateReport(input: { sectionCount: number; traceabilityRate: number }) {
  return {
    ok: input.sectionCount === 6 && input.traceabilityRate >= 0.95,
    sectionCount: input.sectionCount,
    traceabilityRate: input.traceabilityRate,
  }
}
