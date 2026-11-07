export type LeadsEnrichPhonesInput = {
  leadIds: number[]
}

export type LeadsEnrichPhonesOutput = {
  success: boolean
  startedCount: number
  results: Array<{
    leadId: number
    status: 'started' | 'already_running' | 'skipped'
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
