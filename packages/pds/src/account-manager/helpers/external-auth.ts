import { InvalidRequestError } from '@atproto/xrpc-server'
import { AccountDb } from '../db'

export const getByProviderExternalId = async (
  db: AccountDb,
  provider: string,
  externalId: string,
) => {
  return db.db
    .selectFrom('external_auth')
    .selectAll()
    .where('provider', '=', provider)
    .where('externalId', '=', externalId)
    .executeTakeFirst()
}

export const createMapping = async (
  db: AccountDb,
  provider: string,
  externalId: string,
  did: string,
  meta?: string,
) => {
  const now = new Date().toISOString()
  const existing = await getByProviderExternalId(db, provider, externalId)
  if (existing) {
    if (existing.did !== did) {
      throw new InvalidRequestError(
        'External auth already linked to a different account',
      )
    }
    await db.db
      .updateTable('external_auth')
      .set({ updatedAt: now, meta })
      .where('provider', '=', provider)
      .where('externalId', '=', externalId)
      .execute()
    return
  }

  try {
    await db.db
      .insertInto('external_auth')
      .values({
        provider,
        externalId,
        did,
        createdAt: now,
        updatedAt: now,
        meta,
      })
      .execute()
  } catch (err) {
    const current = await getByProviderExternalId(db, provider, externalId)
    if (current) {
      if (current.did !== did) {
        throw new InvalidRequestError(
          'External auth already linked to a different account',
        )
      }
      await db.db
        .updateTable('external_auth')
        .set({ updatedAt: now, meta })
        .where('provider', '=', provider)
        .where('externalId', '=', externalId)
        .execute()
      return
    }
    throw err
  }
}

export const deleteByDid = async (db: AccountDb, did: string) => {
  await db.db.deleteFrom('external_auth').where('did', '=', did).execute()
}
