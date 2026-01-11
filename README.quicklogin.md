# QuickLogin Demo (ID App) for PDS

This fork demonstrates QuickLogin integration in the PDS. It is intended for demos and testing with a QuickLogin provider. It is not a production hardening guide.

## What is implemented

- QuickLogin endpoints: `io.trustanchor.quicklogin.init`, `status`, `callback`, `login`
- Link state endpoints: `io.trustanchor.quicklogin.getLink`, `io.trustanchor.quicklogin.unlink`
- Session storage for QuickLogin flows, including `allowCreate`
- Config wiring for QuickLogin in dev env

## Prerequisites

- Node.js 18 and pnpm
- A QuickLogin provider base URL (example: `https://lab.tagroot.io`)
- An HTTPS public URL for your local PDS (tunnel)

## Configuration

Set these in `packages/dev-env/.env`:

```
PDS_QUICKLOGIN_ENABLED=true
PDS_QUICKLOGIN_ALLOW_ALL=true
PDS_QUICKLOGIN_API_BASE_URL=https://lab.tagroot.io
PDS_PUBLIC_URL=https://<your-tunnel>.trycloudflare.com
```

Notes:

- `PDS_PUBLIC_URL` must be HTTPS or the provider will reject callbacks.
- `PDS_QUICKLOGIN_ALLOW_ALL=true` is for demo mode only.

## Run the dev environment

From the repo root:

```
pnpm install
cd packages/dev-env
pnpm start
```

This starts a local PDS on `http://localhost:2583`.

## Create an HTTPS tunnel

Example with Cloudflared:

```
cloudflared tunnel --url http://localhost:2583
```

Copy the HTTPS URL and set it as `PDS_PUBLIC_URL`.

## QuickLogin demo flow (backend mode)

1. Init:

```
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  'http://localhost:2583/xrpc/io.trustanchor.quicklogin.init' \
  -d '{"allowCreate":true}' | jq
```

1. Fetch QR from provider:

```
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  'https://lab.tagroot.io/QuickLogin' \
  -d '{
    "mode": "image",
    "purpose": "QuickLogin demo for PDS",
    "serviceId": "<serviceId-from-init>",
    "tab": "<sessionId-from-init>"
  }' | jq
```

1. Poll status:

```
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  'http://localhost:2583/xrpc/io.trustanchor.quicklogin.status' \
  -d '{"sessionId":"...","sessionToken":"..."}' | jq
```

1. The provider posts the callback to:

```
https://<your-tunnel>/xrpc/io.trustanchor.quicklogin.callback
```

## Link/unlink endpoints (authenticated)

These require an access JWT (standard bearer token):

```
curl -sS -X POST \
  -H "Authorization: Bearer <accessJwt>" \
  'http://localhost:2583/xrpc/io.trustanchor.quicklogin.getLink' | jq
```

```
curl -sS -X POST \
  -H "Authorization: Bearer <accessJwt>" \
  'http://localhost:2583/xrpc/io.trustanchor.quicklogin.unlink' | jq
```

## Troubleshooting

- "Service URI must use HTTPS": your `PDS_PUBLIC_URL` is not HTTPS.
- "Invalid jwt type at+jwt" during linking: you are on an older PDS build.
