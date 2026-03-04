# VIP DAM - Digital Asset Manager

Medical image management system for VIP Medical Group. Built with Next.js 15 + Supabase.

## Overview

Two-interface system:
- **/admin** - Upload, tag, manage assets and users
- **/home** - Browse, search, download for end users

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database/Auth/Storage:** Supabase
- **Styling:** Tailwind CSS
- **Deployment:** Hostinger VPS via PM2

## Database Schema

| Table | Purpose |
|-------|---------|
| `dam_users` | User profiles (extends Supabase auth) |
| `dam_assets` | Image metadata, paths, processing status |
| `dam_tags` | Tag definitions with categories |
| `dam_asset_tags` | Many-to-many asset↔tag with AI confidence |
| `dam_asset_metadata` | Key-value pairs (doctor, location, etc.) |
| `dam_folders` | Virtual folders (saved filter queries) |
| `dam_download_log` | Audit trail for downloads |
| `dam_activity_log` | General activity audit |

See `supabase/schema.sql` for full schema.

## Storage Buckets (Supabase)

- `dam-originals` - 4K source files (private)
- `dam-previews` - WebP previews (public)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deployment

```bash
npm run build
rsync -avz --delete .next/ root@82.25.91.9:/var/www/vip-dam/.next/
ssh root@82.25.91.9 "pm2 restart vip-dam"
```

**Live URL:** https://mordecai.vipmedicalgroup.ai/vip-dam

## Project Status

🟡 **In Development** - Scaffolding complete, basic routes set up. Ready for feature implementation.

### Completed
- [x] Project structure (Next.js 15 + Tailwind)
- [x] Supabase integration (client + server)
- [x] Database schema designed
- [x] Route structure (/admin, /home, /auth/login)
- [x] Middleware for auth routing
- [x] Sidebar components (Admin + Home)
- [x] TypeScript types

### Next Steps
- [ ] Run schema.sql in Supabase
- [ ] Create storage buckets
- [ ] Build admin upload flow
- [ ] Implement tagging UI
- [ ] Build asset grid/search for /home
- [ ] Add image processing (WebP previews)
