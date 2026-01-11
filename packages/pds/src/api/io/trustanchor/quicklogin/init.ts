import crypto from 'node:crypto'
import { MINUTE } from '@atproto/common'
import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  getQuickLoginSessionStore,
  QUICKLOGIN_SESSION_TTL_MS,
} from './store'

const nsid = 'io.trustanchor.quicklogin.init'

export default function (server: Server, ctx: AppContext) {
  server.xrpc.method(nsid, {
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 60,
        calcKey: ({ req }: any) => req.ip,
      },
    ],
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {},
    }),
    handler: async ({ input, auth, req }: any) => {
      if (ctx.cfg.quicklogin && !ctx.cfg.quicklogin.enabled) {
        throw new InvalidRequestError('QuickLogin disabled')
      }

      const link = Boolean(input?.body?.link)
      const allowCreate = input?.body?.allowCreate !== false
      const signedInDid: string | null = auth?.credentials?.did ?? null
      if (link && !signedInDid) {
        throw new AuthRequiredError('Authentication required to link')
      }

      const sessionId = crypto.randomUUID()
      const sessionToken = crypto.randomBytes(24).toString('hex')
      const publicUrl =
        process.env.PDS_PUBLIC_URL?.trim() || ctx.cfg.service.publicUrl
      const callbackUrl = `${publicUrl}/xrpc/io.trustanchor.quicklogin.callback`
      const providerBaseUrl = normalizeProviderBaseUrl(
        ctx.cfg.quicklogin.apiBaseUrl,
      )
      const providerUrl = new URL('/QuickLogin', providerBaseUrl).toString()

      let response: Response
      try {
        response = await ctx.safeFetch.call(undefined, providerUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            service: callbackUrl,
            sessionId,
          }),
        })
      } catch (err) {
        req.log.error({ err, providerUrl }, 'quicklogin init fetch failed')
        throw new UpstreamFailureError('QuickLogin provider unreachable')
      }

      if (!response.ok) {
        const body = await response.text()
        req.log.error(
          { status: response.status, body },
          'quicklogin init failed',
        )
        throw new UpstreamFailureError(
          `QuickLogin provider error (${response.status})`,
        )
      }

      const data = (await response.json()) as { serviceId?: string } | null
      const serviceId = data?.serviceId
      if (!serviceId || typeof serviceId !== 'string') {
        throw new UpstreamFailureError('Invalid QuickLogin response')
      }

      const now = new Date()
      const expiresAt = new Date(
        now.getTime() + QUICKLOGIN_SESSION_TTL_MS,
      ).toISOString()

      const store = getQuickLoginSessionStore(ctx.redisScratch)
      await store.set(sessionId, {
        sessionId,
        sessionToken,
        serviceId,
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
        linkDid: link ? signedInDid : null,
        allowCreate,
      })

      return {
        encoding: 'application/json',
        body: {
          sessionId,
          sessionToken,
          serviceId,
          expiresAt,
          providerBaseUrl,
        },
      }
    },
  })
}

const normalizeProviderBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim()
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    return new URL(withScheme).toString()
  } catch {
    throw new InvalidRequestError('Invalid QuickLogin provider base URL')
  }
}
