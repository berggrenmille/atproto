import { AppContext } from '../context'
import { Server } from '../lexicon'
import appBsky from './app/bsky'
import comAtproto from './com/atproto'
import ioTrustanchorQuicklogin from './io/trustanchor/quicklogin'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  ioTrustanchorQuicklogin(server, ctx)
  return server
}
