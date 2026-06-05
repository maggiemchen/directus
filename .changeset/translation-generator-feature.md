---
'@directus/api': minor
'@directus/app': minor
---

Added automatic translation structure generation for collections. Admins can now generate translation collections and fields from the collections settings UI without manually setting up multilingual content structures.

**New Features:**
- Added 'Generate Translation Structure' button in collections settings page
- Automatic creation of junction collections, translation fields, and relationships
- Configurable field names, languages collection, and translatable fields
- Auto-creation of languages collection with default languages if it doesn't exist
- Comprehensive UI dialog for configuring translation generation options

**API Changes:**
- Added `POST /collections/:collection/translations/generate` endpoint
- Added TranslationGeneratorService for automated translation structure creation

This feature significantly reduces the manual work required to set up multilingual content in Directus, making it more accessible for content creators and administrators.