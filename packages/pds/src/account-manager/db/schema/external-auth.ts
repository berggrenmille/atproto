export interface ExternalAuth {
  provider: string
  externalId: string
  did: string
  createdAt: string
  updatedAt: string
  meta?: string | null
}

export const tableName = 'external_auth'

export type PartialDB = { [tableName]: ExternalAuth }
