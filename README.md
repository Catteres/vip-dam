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

🟢 **Production Ready** - Core features complete and deployed.

### Admin Features
- [x] Asset library with grid/list view
- [x] Drag & drop upload with tag selection
- [x] Tag management with categories
- [x] Smart folders (saved filter queries)
- [x] User management (roles: admin/user)
- [x] Activity log (download audit)
- [x] Bulk actions (add/remove tags, ZIP download, delete)
- [x] Asset metadata (doctor, location, procedure, etc.)

### End User Features (/home)
- [x] Browse & search assets
- [x] Filter by tags, orientation
- [x] Folder browsing (smart filters)
- [x] Lightbox view with download
- [x] **Favorites** - heart assets to save them
- [x] **Download history** - track your downloads
- [x] Download logging to activity

### Security
- [x] Role-based access control
- [x] Admin routes protected
- [x] Admin link hidden from non-admins

### Remaining / Future
- [ ] AI auto-tagging (schema ready)
- [ ] WebP preview pre-generation (using on-demand transforms)
- [ ] Pagination for large libraries
- [ ] Image zoom in lightbox
