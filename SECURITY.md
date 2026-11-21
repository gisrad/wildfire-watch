# Security Policy

## Architecture & Credential Boundaries

- **Server-side API key isolation**: `FIRMS_MAP_KEY` is stored solely as an encrypted Cloudflare Worker secret (`wrangler secret put FIRMS_MAP_KEY`) or environment variable (`process.env.FIRMS_MAP_KEY` when running `scripts/bake-replay.mjs`). It is never bundled into static client assets or returned in HTTP responses.
- **SQLite parameterization**: All queries to Cloudflare D1 (`worker/index.js`) use prepared parameter bindings (`.bind(...)`).
- **HTTP security headers**: Static assets and JSON endpoints enforce `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Environment hygiene**: `wrangler.toml` and `.dev.vars` are excluded via `.gitignore`; only the sanitized `wrangler.toml.example` template is tracked. Automated checks (`npm run check:security`) fail on leaked UUIDs, tokens, email addresses, or local paths.

## Supported Versions

Only the latest state of the `main` branch and the live deployment at `https://fire.transbulent.id` are supported.

## Reporting a Vulnerability

If you discover a security issue (such as a CSP bypass, injection vector, or accidental credential exposure), please report it privately using GitHub Security Advisories:

- <https://github.com/gisrad/wildfire-watch/security/advisories/new>

Please avoid opening public issues for unpatched security vulnerabilities.
