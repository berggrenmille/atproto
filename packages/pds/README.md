# @atproto/pds: Personal Data Server (PDS)

TypeScript reference implementation of an atproto PDS.

[![NPM](https://img.shields.io/npm/v/@atproto/pds)](https://www.npmjs.com/package/@atproto/pds)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

If you are interested in self-hosting a PDS, you probably want this repository instead, which has a thin service wrapper, documentation, a Dockerfile, etc: https://github.com/bluesky-social/pds

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.

## QuickLogin (demo)

A demo endpoint is available to link/login/create accounts using an external identity (JID) without verification. It is disabled by default.

- Enable via environment variables:
	- `PDS_QUICKLOGIN_ENABLED=true`
	- `PDS_QUICKLOGIN_ALLOW_ALL=true`

- Endpoint (unauthenticated allowed): `io.trustanchor.quicklogin.login`

- Example request:

```
curl -sS -X POST \
	-H 'Content-Type: application/json' \
	"http://localhost:2583/xrpc/io.trustanchor.quicklogin.login" \
	-d '{
		"JID": "jid-123456",
		"Provider": "neuroaccess",
		"Domain": "lab.tagroot.io",
		"Properties": {"email": "demo@example.com", "FIRST": "Demo", "LAST": "User"}
	}'
```

Responses:
- Existing mapping, not signed-in: returns `accessJwt`, `refreshJwt`, `did`, `handle`, `linked=true`, `created=false`.
- Signed-in, no mapping: links current account, returns `did`, `handle`, `linked=true`, `created=false`.
- No mapping, not signed-in: creates a new account + session, returns tokens and `created=true`.
