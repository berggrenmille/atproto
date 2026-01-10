import { MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { QuickLoginPayload, runQuickLogin } from './logic'
import { getQuickLoginSessionStore } from './store'

const nsid = 'io.trustanchor.quicklogin.callback'

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
    handler: async ({ input, req }: any) => {
      if (ctx.cfg.quicklogin && !ctx.cfg.quicklogin.enabled) {
        throw new InvalidRequestError('QuickLogin disabled')
      }

      const body: QuickLoginPayload = input?.body ?? {}
      const sessionId = body.SessionId || (body as any).sessionId
      if (!sessionId || typeof sessionId !== 'string') {
        throw new InvalidRequestError('Missing SessionId')
      }

      const store = getQuickLoginSessionStore(ctx.redisScratch)
      const session = await store.get(sessionId)
      if (!session) {
        throw new InvalidRequestError('Unknown or expired session')
      }

      if (session.status === 'completed') {
        return { encoding: 'application/json', body: { ok: true } }
      }

      try {
        assertPayloadApproved(ctx, body)
        const result = await runQuickLogin({
          ctx,
          payload: body,
          authDid: session.linkDid ?? null,
          reqIp: req.ip,
        })
        await store.set(sessionId, {
          ...session,
          status: 'completed',
          updatedAt: new Date().toISOString(),
          result,
        })
      } catch (err: any) {
        const message = err?.message || 'QuickLogin failed'
        await store.set(sessionId, {
          ...session,
          status: 'failed',
          updatedAt: new Date().toISOString(),
          error: message,
        })
        return { encoding: 'application/json', body: { ok: false } }
      }

      return { encoding: 'application/json', body: { ok: true } }
    },
  })
}

const assertPayloadApproved = (ctx: AppContext, payload: QuickLoginPayload) => {
  if (payload.State !== 'Approved') {
    throw new InvalidRequestError('QuickLogin state not approved')
  }
  if (!ctx.cfg.quicklogin.allowAll) {
    throw new InvalidRequestError('QuickLogin verification not implemented')
  }
}
