import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { didDocForSession, safeResolveDidDoc } from '../../../com/atproto/server/util'
import { syncEvtDataFromCommit } from '../../../../sequencer'
import * as externalAuth from '../../../../account-manager/helpers/external-auth'

export type QuickLoginPayload = {
  JID?: string
  Id?: string
  Provider?: string
  Domain?: string
  Key?: string
  ClientKeyName?: string
  Created?: number
  Updated?: number
  From?: number
  To?: number
  HasClientPublicKey?: boolean
  ClientPubKey?: string
  HasClientSignature?: boolean
  ClientSignature?: string
  ServerSignature?: string
  Properties?: Record<string, unknown>
  Attachments?: Array<{
    Id: string
    ContentType: string
    FileName?: string
    Url?: string
    BackEndUrl?: string
  }>
  SessionId?: string
  State?: string
}

export type QuickLoginResult = {
  accessJwt?: string
  refreshJwt?: string
  did: string
  didDoc?: unknown
  handle: string
  linked: boolean
  created: boolean
  provider: string
  externalId: string
}

export const runQuickLogin = async ({
  ctx,
  payload,
  authDid,
  reqIp,
}: {
  ctx: AppContext
  payload: QuickLoginPayload
  authDid: string | null
  reqIp: string
}): Promise<QuickLoginResult> => {
  if (ctx.cfg.quicklogin && !ctx.cfg.quicklogin.enabled) {
    throw new InvalidRequestError('QuickLogin disabled')
  }

  const provider = getProviderKey(ctx)
  const externalId = payload.JID
  if (!externalId) {
    throw new InvalidRequestError('Missing JID in QuickLogin payload')
  }
  const mappingMeta = buildMappingMeta(payload, reqIp)

  const existing = await externalAuth.getByProviderExternalId(
    ctx.accountManager.db,
    provider,
    externalId,
  )

  if (existing?.did) {
    if (authDid && existing.did !== authDid) {
      throw new InvalidRequestError(
        'QuickLogin already linked to a different account',
      )
    }

    if (!authDid) {
      const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
        ctx.accountManager.createSession(existing.did, null, false),
        didDocForSession(ctx, existing.did),
      ])

      return {
        accessJwt,
        refreshJwt,
        did: existing.did,
        didDoc,
        handle: (await ctx.accountManager.getAccount(existing.did))?.handle ?? '',
        linked: true,
        created: false,
        provider,
        externalId,
      }
    }

    return {
      did: existing.did,
      didDoc: await didDocForSession(ctx, existing.did),
      handle: (await ctx.accountManager.getAccount(existing.did))?.handle ?? '',
      linked: true,
      created: false,
      provider,
      externalId,
    }
  }

  if (authDid) {
    await externalAuth.createMapping(
      ctx.accountManager.db,
      provider,
      externalId,
      authDid,
      mappingMeta,
    )
    return {
      did: authDid,
      didDoc: await didDocForSession(ctx, authDid),
      handle: (await ctx.accountManager.getAccount(authDid))?.handle ?? '',
      linked: true,
      created: false,
      provider,
      externalId,
    }
  }

  if (ctx.cfg.quicklogin && ctx.cfg.quicklogin.enabled) {
    const baseFromProps = deriveBaseHandleFromProperties(payload.Properties)
    const handle = await deriveAvailableHandle(ctx, baseFromProps)

    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const rotationKeys = [ctx.plcRotationKey.did()]
    if (ctx.cfg.identity.recoveryDidKey) {
      rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
    }
    const plcCreate = await plc.createOp({
      signingKey: signingKey.did(),
      rotationKeys,
      handle,
      pds: ctx.cfg.service.publicUrl,
      signer: ctx.plcRotationKey,
    })

    const did = plcCreate.did

    await ctx.actorStore.create(did, signingKey)
    let didDoc
    try {
      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.repo.createRepo([]),
      )

      await ctx.plcClient.sendOperation(did, plcCreate.op)

      didDoc = await safeResolveDidDoc(ctx, did, true)

      const creds = await ctx.accountManager.createAccountAndSession({
        did,
        handle,
        repoCid: commit.cid,
        repoRev: commit.rev,
        deactivated: false,
      })

      await ctx.sequencer.sequenceIdentityEvt(did, handle)
      await ctx.sequencer.sequenceAccountEvt(
        did,
        await ctx.accountManager.getAccountStatus(did),
      )
      await ctx.sequencer.sequenceCommit(did, commit)
      await ctx.sequencer.sequenceSyncEvt(did, syncEvtDataFromCommit(commit))
      await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
      await ctx.actorStore.clearReservedKeypair(signingKey.did(), did)

      await externalAuth.createMapping(
        ctx.accountManager.db,
        provider,
        externalId,
        did,
        mappingMeta,
      )

      return {
        accessJwt: creds.accessJwt,
        refreshJwt: creds.refreshJwt,
        did,
        didDoc,
        handle,
        linked: false,
        created: true,
        provider,
        externalId,
      }
    } catch (err) {
      await ctx.actorStore.destroy(did)
      throw err
    }
  }

  throw new InvalidRequestError('QuickLogin is not enabled')
}

function deriveBaseHandleFromProperties(props?: Record<string, unknown>) {
  if (!props) return 'ql-user'
  const email = props.EMAIL || props.email
  if (typeof email === 'string' && email.includes('@')) {
    return email.split('@')[0]
  }
  const first = props.FIRST || props.first
  const last = props.LAST || props.last
  const parts = [
    typeof first === 'string' ? first : '',
    typeof last === 'string' ? last : '',
  ].filter(Boolean)
  const name = parts.join('-')
  if (name) return name
  return 'ql-user'
}

async function deriveAvailableHandle(ctx: AppContext, base: string) {
  const handleDomain = pickHandleDomain(ctx)
  const norm =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$|_/g, '')
      .slice(0, 20) || 'ql-user'
  const root = `${norm}${handleDomain}`
  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? root : `${norm}${i}${handleDomain}`
    try {
      await ctx.accountManager.normalizeAndValidateHandle(candidate)
      const exists = await ctx.accountManager.getAccount(candidate)
      if (!exists) return candidate
    } catch {
      // try next
    }
  }
  return `ql-${Date.now().toString(36)}${handleDomain}`
}

function pickHandleDomain(ctx: AppContext) {
  return ctx.cfg.identity.serviceHandleDomains[0] || '.test'
}

function buildMappingMeta(payload: QuickLoginPayload, reqIp: string) {
  return JSON.stringify({
    ip: reqIp,
    at: new Date().toISOString(),
    id: payload.Id ?? null,
    provider: payload.Provider ?? null,
    domain: payload.Domain ?? null,
    key: payload.Key ?? null,
    sessionId: payload.SessionId ?? null,
  })
}

function getProviderKey(ctx: AppContext) {
  const baseUrl = ctx.cfg.quicklogin?.apiBaseUrl || 'https://lab.tagroot.io'
  const normalized = normalizeProviderBaseUrl(baseUrl)
  return new URL(normalized).hostname
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
