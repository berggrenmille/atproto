import { MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { getQuickLoginSessionStore } from './store'

const nsid = 'io.trustanchor.quicklogin.status'

export default function (server: Server, ctx: AppContext) {
  server.xrpc.method(nsid, {
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 120,
        calcKey: ({ req }: any) => req.ip,
      },
    ],
    auth: ctx.authVerifier.unauthenticated,
    handler: async ({ input }: any) => {
      const body = input?.body ?? {}
      const sessionId = body.sessionId
      const sessionToken = body.sessionToken
      if (!sessionId || !sessionToken) {
        throw new InvalidRequestError('Missing sessionId or sessionToken')
      }

      const store = getQuickLoginSessionStore(ctx.redisScratch)
      const session = await store.get(sessionId)
      if (!session) {
        throw new InvalidRequestError('Unknown or expired session')
      }
      if (session.sessionToken !== sessionToken) {
        throw new InvalidRequestError('Invalid session token')
      }

      return {
        encoding: 'application/json',
        body: {
          status: session.status,
          result: session.result,
          error: session.error,
          expiresAt: session.expiresAt,
        },
      }
    },
  })
}
