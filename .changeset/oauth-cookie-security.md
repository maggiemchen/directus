---
'@directus/api': minor
'@directus/env': minor
---

Added OAuth/OpenID cookie security configuration options. OAuth and OpenID authentication providers now support `AUTH_{PROVIDER}_COOKIE_SECURE` and `AUTH_{PROVIDER}_COOKIE_SAME_SITE` environment variables to control the security attributes of intermediate authentication cookies. These settings allow users to configure secure cookie behavior when serving Directus over HTTPS, including when behind a proxy. When not specified, these settings fall back to the corresponding session cookie configuration (`SESSION_COOKIE_SECURE` and `SESSION_COOKIE_SAME_SITE`).