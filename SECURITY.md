# Security Policy

## Supported Versions

This project currently supports the `main` branch.

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report security issues privately via GitHub Security Advisories:
https://github.com/aurelienlewin/rgaa-vitrine/security/advisories

If unavailable, contact the maintainer profile:
https://github.com/aurelienlewin

## Security Notes for Contributors

- Never remove SSRF protections around remote URL fetching.
- Keep DNS/IP validation for private/local targets.
- Keep request timeout and response size limits.
- Avoid rendering untrusted HTML from analyzed websites.
- Keep moderation endpoints protected by a strong `MODERATION_API_TOKEN` (minimum 32 chars).
- Keep brute-force resistance on moderation auth (failed attempts must stay rate-limited).
- Treat moderation archive export/import payloads as sensitive operational data.
- If enabled, keep `MODERATION_ARCHIVE_SIGNING_SECRET` strong (minimum 32 chars) and rotate it securely.
- Keep rollback imports explicit (`allowRollback=true`) to avoid accidental destructive restores from stale archives.
- Never commit secrets (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `.env` files).
- If using GitHub notifications, use a fine-grained token scoped to one repository with Issues write only.
- Use `GITHUB_NOTIFY_TOKEN` / `RGAA_NOTIFY_TOKEN` only (no implicit `GITHUB_TOKEN` fallback).
- If overriding `GITHUB_API_URL`, keep it on a public HTTPS host; never point to localhost/private/internal hosts.
