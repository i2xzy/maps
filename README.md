# My Mapping Projects

A monorepo for my mapping projects, currently featuring the High Speed Progress project and coming soon, the London Cycling Routes.

## Projects

### High Speed Progress
A comprehensive web application for tracking the construction progress of the UK High Speed railway project, including:
- Real-time construction status updates
- Interactive structure database (stations, bridges, tunnels, viaducts)
- News feed with videos and images from YouTube creators
- Regional route breakdowns with plan sheets
- Content creator directory

**Live Site:** https://hsp-bice.vercel.app/

### London Cycle Routes (Planned)
Future project for mapping safe cycling routes around London.

## 🏗️ Architecture

This is a [Turborepo](https://turborepo.com) monorepo with the following structure:

### Apps
- `apps/hs2` - High Speed Progress Next.js application
- `apps/london-cycle-routes` - London Cycle Routes Next.js application (in development)

### Packages
- `@repo/ui` - Shared React UI components and helpers
  - Chakra UI v3 components (Breadcrumb, ColorMode, CommandMenu, Logo, Provider, Tooltip)
  - Helper functions for date and text formatting
- `@repo/supabase` - Supabase client configuration and TypeScript types
  - Database types (auto-generated from Supabase)
  - Server and client Supabase client configurations
  - Feature and grouping types
- `@repo/eslint-config` - Shared ESLint configurations
- `@repo/typescript-config` - Shared TypeScript configurations

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **UI Library:** Chakra UI v3
- **Backend:** Supabase (PostgreSQL with PostGIS)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Deployment:** Vercel

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm 9+
- Supabase account (for database access)

### Installation

1. Clone the repository:
    ```bash
    git clone [your-repo-url]
    cd maps
    ```

2. Install dependencies:
    ```bash
    pnpm install
    ```

3. Set up environment variables:
    ```bash
    # In apps/hs2/.env.local
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. Run the development server:
    ```bash
    pnpm dev
    ```

    This will start all apps in development mode:
    - HS2 app: http://localhost:3000
    - London Cycle Routes app: http://localhost:3001

    Alternatively, you can run:
    ```bash
    pnpm dev --filter hs2
    ```
    This will start just the HS2 app on http://localhost:3000

### Development Commands

```bash
# Run all apps in development
pnpm dev

# Build all apps and packages
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm check-types
```

## 📁 Project Structure

```
maps/
├── apps/
│   ├── hs2/                    # HS Progress
│   │   ├── app/               # Next.js app directory
│   │   ├── components/        # React components
│   │   └── utils/             # Utility functions
│   └── london-cycle-routes/   # London Cycle Routes (planned)
├── packages/
│   ├── ui/                    # Shared UI components
│   ├── supabase/             # Supabase configuration
│   ├── eslint-config/        # ESLint configs
│   └── typescript-config/    # TypeScript configs
└── turbo.json                # Turborepo configuration
```

## 🗄️ Database Schema

The HS2 tracker uses Supabase with the following main tables:
- `features` - Railway structures (stations, bridges, tunnels, viaducts, etc.)
- `media` - Videos and images from content creators
- `creators` - YouTube channels and content creators
- `groupings` - Plan sheets and feature groupings
- `media_features` - Links media to features
- `grouping_features` - Links groupings to features

## 📝 Contributing

This is currently a personal project, but contributions and suggestions are welcome!

<!-- ## 📄 License

[Your License Here] -->

## 🙏 Acknowledgments

- HS2 Ltd for public construction data
- YouTube creators documenting the HS2 construction
- Supabase for backend infrastructure
- Vercel for hosting
