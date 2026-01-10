import { MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { QuickLoginPayload, runQuickLogin } from './logic'

const nsid = 'io.trustanchor.quicklogin.login'

export default function (server: Server, ctx: AppContext) {
  server.xrpc.method(nsid, {
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 60,
        calcKey: ({ req }: any) => req.ip,
      },
    ],
    auth: ctx.authVerifier.userServiceAuthOptional,
    handler: async ({ input, auth, req }: any) => {
      if (!auth?.credentials?.did && !ctx.cfg.quicklogin.allowAll) {
        throw new InvalidRequestError('QuickLogin verification not implemented')
      }
      const body: QuickLoginPayload = input?.body ?? {}
      const result = await runQuickLogin({
        ctx,
        payload: body,
        authDid: auth?.credentials?.did ?? null,
        reqIp: req.ip,
      })
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
