import type { DigestItem } from '../schema/item.js'

type ClinicalTrialsApiResponse = {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: {
        nctId?: string
        briefTitle?: string
      }
      statusModule?: {
        overallStatus?: string
        lastUpdatePostDateStruct?: {
          date?: string
        }
        lastUpdatePostDate?: string
      }
      designModule?: {
        phases?: string[]
        enrollmentInfo?: {
          count?: number
        }
      }
      conditionsModule?: {
        conditions?: string[]
      }
    }
  }>
}

function buildPhaseScore(phase?: string): number {
  if (!phase) return 0.2
  if (phase.includes('PHASE3')) return 1
  if (phase.includes('PHASE2')) return 0.8
  if (phase.includes('PHASE1')) return 0.6
  return 0.4
}

export async function fetchClinicalTrials(_date: string): Promise<DigestItem[]> {
  try {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies')
    url.searchParams.set('query.cond', 'pancreatic cancer')
    url.searchParams.set('pageSize', '10')
    url.searchParams.set('sort', 'LastUpdatePostDate:desc')
    url.searchParams.set('filter.overallStatus', 'RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING')

    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: 'application/json',
      },
    })
    if (!response.ok) {
      return []
    }

    const data = await response.json() as ClinicalTrialsApiResponse
    const now = new Date().toISOString()

    const items: Array<DigestItem | null> = (data.studies ?? [])
      .map((study): DigestItem | null => {
        const protocol = study.protocolSection ?? {}
        const ident = protocol.identificationModule ?? {}
        const status = protocol.statusModule ?? {}
        const design = protocol.designModule ?? {}
        const nctId = ident.nctId?.trim()
        const title = ident.briefTitle?.trim()

        if (!nctId || !title) {
          return null
        }

        const phase = (design.phases ?? [])[0]
        const overallStatus = status.overallStatus ?? 'UNKNOWN'
        const conditions = protocol.conditionsModule?.conditions ?? []
        const updatedAt = status.lastUpdatePostDateStruct?.date ?? status.lastUpdatePostDate ?? now

        return {
          id: `clinicaltrials:${nctId}`,
          title,
          sourceType: 'clinical_trials',
          sectionHint: 'clinical_trials_and_drug_rnd',
          sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
          fetchedAt: now,
          evidence: [
            `nct:${nctId}`,
            `status:${overallStatus}`,
            ...(phase ? [`phase:${phase}`] : []),
            ...(conditions[0] ? [`condition:${conditions[0]}`] : []),
          ],
          phase,
          scoreBreakdown: {
            evidence: 0.9,
            timeliness: 0.8,
            relevance: 1,
            actionability: 0.9,
            phase: buildPhaseScore(phase),
          },
        }
      })
    return items
      .filter((item): item is DigestItem => item !== null)
      .sort((left, right) => (right.scoreBreakdown?.phase ?? 0) - (left.scoreBreakdown?.phase ?? 0))
  } catch {
    return []
  }
}
