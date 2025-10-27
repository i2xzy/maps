# HS2 Progress Tracker

A comprehensive web application for tracking the construction progress of the HS2 (High Speed 2) railway project in the United Kingdom.

## 🌟 Features

### 📰 News Feed
- Video and image updates from YouTube creators and official sources
- YouTube video embeds with creator attribution
- Image galleries from construction sites
- Filter content by creator and date

### 🏗️ Structures Database
- **Stations** - Major railway stations along the route
- **Bridges** - Overbridges and underbridges
- **Tunnels** - Twin-bore tunnels, green tunnels, and cut-and-cover sections
- **Viaducts** - Major elevated structures
- **Other Features** - Embankments, cuttings, culverts, and shafts

Each structure includes:
- Current construction status
- Technical specifications
- Related media (photos, videos)
- PDF plan sheets
- Geographical location (chainage)

### 🗺️ Route Overview
- Regional breakdown of the HS2 route
- Plan sheets organized by region
- Progress charts for each region

### 👥 Content Creators
- Directory of YouTube channels documenting HS2
- Direct links to YouTube channels

### 🔍 Search
- Fast full-text search across all structures
- Keyboard shortcut (Cmd/Ctrl + K)
- Filter by structure type

### 📊 Progress Tracking
- Construction status updates
- Visual progress charts
- Status categories:
  - Not Started
  - In Progress (Earthworks, Piling, Foundations, Superstructure, Finishing)
  - Complete
  - Special states (Paused, Cancelled, TBM operations)

## 🛠️ Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **UI Library:** Chakra UI v3
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Charts:** Recharts
- **Icons:** React Icons (Font Awesome, Lucide)
- **Deployment:** Vercel

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 9+
- Supabase project with HS2 database

### Environment Variables

Create a `.env.local` file in the `apps/hs2` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

From the root of the monorepo:

```bash
# Install dependencies
pnpm install

# Run development server (from root or apps/hs2)
pnpm dev

# Run just the hs2 sub repo (from root)
pnpm dev --filter hs2

# Build for production
pnpm build

# Start production server
pnpm start
```

The app will be available at http://localhost:3000

## 📁 Project Structure

```
apps/hs2/
├── app/
│   ├── (dashboard)/          # Dashboard layout group
│   │   ├── map/             # Interactive map (planned)
│   │   └── page.tsx         # Home/dashboard
│   ├── (wiki)/              # Wiki layout group
│   │   ├── creators/        # Content creator pages
│   │   ├── media/           # Media gallery and detail pages
│   │   ├── route/           # Route overview and regional pages
│   │   └── structures/      # Structure database pages
│   ├── layout.tsx           # Root layout with metadata
│   └── favicon.ico
├── components/
│   ├── feature/             # Feature-related components
│   │   ├── config.ts       # Feature types and status config
│   │   ├── feature-icon.tsx
│   │   ├── feature-section.tsx
│   │   └── feature-status-badge.tsx
│   ├── media/
│   │   └── media-gallery.tsx
│   ├── header.tsx           # Main navigation header
│   ├── progress-chart.tsx   # Recharts wrapper
│   └── stat-card.tsx
├── utils/
│   ├── feature-routing.ts   # Dynamic route generation
│   └── progress-data.ts     # Progress chart data helpers
├── middleware.ts            # Supabase auth middleware
└── next.config.js
```

## 🗄️ Database Schema

### Main Tables

**features**
- Stores all railway structures (stations, bridges, tunnels, etc.)
- Includes PostGIS geometry for mapping
- Tracks construction status
- Uses chainage for linear referencing

**media**
- Videos and images from various sources
- Links to creators
- Includes YouTube video IDs for embeds
- Tracks publication and recording dates

**creators**
- YouTube channels and content creators
- Profile information and bios
- Channel URLs and external IDs

**groupings**
- Plan sheets and feature collections
- Organizes structures by drawing/plan
- Includes PDF URLs for official documents

**media_features** (junction table)
- Links media items to related structures
- Many-to-many relationship

**groupings_features** (junction table)
- Links groupings items to related structures
- Many-to-many relationship

## 🎨 Key Features Implementation

### Centralized Configuration
All feature types and statuses are defined in `components/feature/config.ts`:
- Consistent icons and colors
- Reusable across components
- Easy to maintain and extend

### Utility Functions
- `progress-data.ts` - Generate chart data from features
- `feature-routing.ts` - Dynamic route generation for structure types
- `text-formatting.ts` - Format chainage, convert snake_case
- `date-formatting.ts` - Consistent date formatting

### Reusable Components
- `FeatureStatusBadge` - Display construction status
- `MediaGallery` - Responsive grid of media items
- `ProgressChart` - Chakra UI charts bar segment chart wrapper
- `FeatureIcon` - Type-specific icons with colors

### Responsive Design
- Mobile-first approach
- Responsive navigation with mobile drawer
- Adaptive layouts for all screen sizes
- Touch-friendly interactions

## 🔮 Planned Features

- [ ] Interactive map with route visualization
<!-- - [ ] User accounts and favorites -->
<!-- - [ ] Email notifications for updates -->
- [ ] Timeline view of construction progress
- [ ] Advanced filtering and search
- [ ] Comparison tools (planned vs. actual)
- [ ] Photo timeline by structure
- [ ] Admin dashboard for content management

## 📊 Performance

- Server-side rendering for fast initial loads
- Image optimization with Next.js Image
- Efficient database queries with Supabase
- Code splitting by route
- Responsive images and lazy loading

## 🧪 Development

### Type Generation

Regenerate Supabase types when database schema changes:

```bash
# From packages/supabase
pnpm supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

### Code Quality

```bash
# Run linter
pnpm lint

# Type checking
pnpm check-types
```

## 🚢 Deployment

The app is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

<!-- ## 📄 License

[Your License Here] -->

## 🙏 Acknowledgments

- HS2 Ltd for public construction information
- YouTube creators documenting the construction
- OpenStreetMap contributors
- Supabase for backend infrastructure
- Vercel for hosting

---

**Note:** This is an independent project and is not affiliated with or endorsed by HS2 Ltd.
