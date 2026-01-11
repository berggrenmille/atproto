import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as externalAuth from '../../../../account-manager/helpers/external-auth'
import { getProviderKey } from './logic'

const nsid = 'io.trustanchor.quicklogin.getLink'

export default function (server: Server, ctx: AppContext) {
  server.xrpc.method(nsid, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {},
    }),
    handler: async ({ auth }: any) => {
      if (ctx.cfg.quicklogin && !ctx.cfg.quicklogin.enabled) {
        throw new InvalidRequestError('QuickLogin disabled')
      }
      const did = auth?.credentials?.did
      if (!did) {
        throw new InvalidRequestError('Missing auth DID')
      }
      const provider = getProviderKey(ctx)
      const existing = await externalAuth.getByProviderDid(
        ctx.accountManager.db,
        provider,
        did,
      )
      return {
        encoding: 'application/json',
        body: {
          linked: !!existing,
          provider,
        },
      }
    },
  })
}
