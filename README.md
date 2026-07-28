# My Mapping Projects

A monorepo for my mapping projects, currently featuring the High Speed Progress project, a railway route diagram editor, and coming soon, the London Cycling Routes.

## Projects

### High Speed Progress
A comprehensive web application for tracking the construction progress of the UK High Speed railway project, including:
- Real-time construction status updates
- Interactive structure database (stations, bridges, tunnels, viaducts)
- News feed with videos and images from YouTube creators
- Regional route breakdowns with plan sheets
- Content creator directory

**Live Site:** https://hsp-bice.vercel.app/

### Route Diagram Editor
A visual editor for the `{{Routemap}}` railway route diagrams that run down the side of
Wikipedia railway articles. Those are normally hand-written wikitext:

```
{{rws|Moorgate Halt}}! !\\eHST\exHST~~{{rws|Friezland}}
{{tram|Derker}}! !\uHST\exHST\~~{{rws|Lees}}
```

Each glyph is a column of track; `! !` and `~~` separate up to four label slots on each
side. The editor lets you build that by clicking, with a live preview and the wikitext
beside it, and **Import** takes a `{{Routemap}}` pasted from any article or template.

**Status:** works locally, not deployed yet. The renderer, editor and wikitext importer
all work; see [What's missing](#whats-missing) for the gaps.

### London Cycle Routes (Planned)
Future project for mapping safe cycling routes around London.

## 🏗️ Architecture

This is a [Turborepo](https://turborepo.com) monorepo with the following structure:

### Apps
- `apps/hs2` - High Speed Progress Next.js application
- `apps/routemap-editor` - Visual editor for railway route diagrams
- `apps/london-cycle-routes` - London Cycle Routes Next.js application (in development)

### Packages
- `@repo/routemap` - Railway route diagrams: renders one from JSON, serializes it to
  `{{Routemap}}` wikitext, and parses wikitext back. Ships a generated catalog of 2,130
  `{{rint}}` transit logos so browsing needs no network.
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
    - Route Diagram Editor: http://localhost:3002

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

# Tests (routemap package + editor)
pnpm test
```

### Regenerating the logo catalog

`packages/routemap/src/rint-catalog.data.ts` is generated from
[Template:Rail-interchange](https://en.wikipedia.org/wiki/Template:Rail-interchange) and
checked in, so nothing needs the network at build time. It only needs regenerating when
that template changes:

```bash
cd packages/routemap
pnpm build-rint-catalog                              # ~20 min, throttled to be polite
pnpm build-rint-catalog --limit 20 --out /tmp/x.ts   # smoke-test the pipeline in seconds
```

## 📁 Project Structure

```
maps/
├── apps/
│   ├── hs2/                    # HS Progress
│   │   ├── app/               # Next.js app directory
│   │   ├── components/        # React components
│   │   └── utils/             # Utility functions
│   ├── routemap-editor/       # Route diagram editor
│   └── london-cycle-routes/   # London Cycle Routes (planned)
├── packages/
│   ├── routemap/              # Route diagram renderer + wikitext parser
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

## 📐 How faithful is the route diagram parser?

Measured against a fixture of 22 real Wikipedia diagrams — 1,036 rows — rather than
hand-written examples:

- **94.4%** of rows survive wikitext → model → wikitext unchanged in meaning
- **100%** of `{{Routemap}}` wrappers rebuild byte-for-byte, so no template parameter is
  lost or reformatted
- rows you haven't edited export **byte-for-byte from the original**, so editing one row of
  an imported diagram doesn't quietly rewrite the rest

That last point is what makes it safe to paste the result back into an article. All three
are asserted as a floor in the test suite, so they can only go up.

<h2 id="whats-missing">🧭 What's missing</h2>

For the route diagram editor:

- Not deployed yet.
- About half of BSicon cell codes decode into the semantic form the editor's controls
  edit; the rest are preserved and visible, but only editable as text.
- A `{{BSsplit}}` written as an explicit run rather than a line break isn't editable in
  the GUI.
- Unrecognised templates (`{{BSto}}`, `{{tram}}`, `{{stnlnk}}` — about a fifth of rows)
  render as a muted placeholder instead of being expanded.
- No mobile layout.

## 📝 Contributing

This is currently a personal project, but contributions and suggestions are welcome!

## 📄 License

[MIT](./LICENSE) for this repository's own code.

The BSicons and transit logos are **not** mine and aren't redistributed here — they're
fetched from Wikimedia Commons at render time, each under its own licence. 266 of the
1,155 logo files require crediting their author if you display them.
[NOTICE.md](./NOTICE.md) has the details, and `logoCredits()` returns what to publish.

## 🙏 Acknowledgments

- HS2 Ltd for public construction data
- The Wikipedia editors who maintain `{{Routemap}}`, `Module:Routemap` and the BSicon set
- YouTube creators documenting the HS2 construction
- Supabase for backend infrastructure
- Vercel for hosting
