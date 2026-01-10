import { MINUTE } from '@atproto/common'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'
import { Redis } from 'ioredis'
import { QuickLoginResult } from './logic'

export type QuickLoginSessionStatus = 'pending' | 'completed' | 'failed'

export type QuickLoginSession = {
  sessionId: string
  sessionToken: string
  serviceId: string
  status: QuickLoginSessionStatus
  createdAt: string
  updatedAt: string
  expiresAt: string
  linkDid?: string | null
  allowCreate?: boolean
  result?: QuickLoginResult
  error?: string
}

export type QuickLoginSessionStore = {
  get: (sessionId: string) => Promise<QuickLoginSession | undefined>
  set: (sessionId: string, session: QuickLoginSession) => Promise<void>
  del: (sessionId: string) => Promise<void>
}

export const QUICKLOGIN_SESSION_TTL_MS = 10 * MINUTE

const createMemoryStore = (): QuickLoginSessionStore => {
  const store = new SimpleStoreMemory<string, QuickLoginSession>({
    max: 10000,
    ttl: QUICKLOGIN_SESSION_TTL_MS,
    ttlAutopurge: true,
  })
  return {
    get: async (sessionId) => store.get(sessionId),
    set: async (sessionId, session) => {
      store.set(sessionId, session)
    },
    del: async (sessionId) => {
      store.del(sessionId)
    },
  }
}

const createRedisStore = (redis: Redis): QuickLoginSessionStore => {
  const store = new SimpleStoreRedis<string, QuickLoginSession>(redis, {
    keyPrefix: 'quicklogin:',
    ttl: QUICKLOGIN_SESSION_TTL_MS,
  })
  return {
    get: (sessionId) => store.get(sessionId),
    set: (sessionId, session) => store.set(sessionId, session),
    del: (sessionId) => store.del(sessionId),
  }
}

let sessionStore: QuickLoginSessionStore | null = null

export const getQuickLoginSessionStore = (
  redis?: Redis,
): QuickLoginSessionStore => {
  if (!sessionStore) {
    sessionStore = redis ? createRedisStore(redis) : createMemoryStore()
  }
  return sessionStore
}
