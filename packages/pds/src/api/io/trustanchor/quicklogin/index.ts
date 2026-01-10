import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import quickloginCallback from './callback'
import quickloginInit from './init'
import quickloginLogin from './login'
import quickloginStatus from './status'

export default function (server: Server, ctx: AppContext) {
  quickloginInit(server, ctx)
  quickloginCallback(server, ctx)
  quickloginLogin(server, ctx)
  quickloginStatus(server, ctx)
}
