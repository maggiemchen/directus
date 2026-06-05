---
'@directus/env': minor
'@directus/api': minor
---

Added cache revalidation support for assets using ETag and conditional requests. This feature can be enabled/disabled via the ASSETS_CACHE_REVALIDATION environment variable (defaults to true).