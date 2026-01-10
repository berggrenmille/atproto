/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'io.trustanchor.quicklogin.login'

export type QueryParams = {}

export interface InputSchema {
  JID: string
  Provider?: string
  Domain?: string
  Key?: string
  Properties?: { [_ in string]: unknown }
  Attachments?: Attachment[]
}

export interface OutputSchema {
  accessJwt?: string
  refreshJwt?: string
  handle: string
  did: string
  didDoc?: { [_ in string]: unknown }
  linked: boolean
  created: boolean
  provider?: string
  externalId?: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface Attachment {
  $type?: 'io.trustanchor.quicklogin.login#attachment'
  Id?: string
  ContentType?: string
  FileName?: string
  Url?: string
  BackEndUrl?: string
}

const hashAttachment = 'attachment'

export function isAttachment<V>(v: V) {
  return is$typed(v, id, hashAttachment)
}

export function validateAttachment<V>(v: V) {
  return validate<Attachment & V>(v, id, hashAttachment)
}
