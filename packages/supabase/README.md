# @repo/supabase

Shared Supabase configuration and utilities for the Maps monorepo with proper Next.js integration.

## Architecture

This package uses **peer dependencies** for Next.js to avoid bundling Next.js within the shared package. This is the recommended approach because:

1. **Avoids version conflicts** - Each app manages its own Next.js version
2. **Reduces bundle size** - Next.js isn't duplicated across packages
3. **Proper module resolution** - Next.js server utilities work correctly
4. **Flexibility** - Apps can use different Next.js versions if needed

## Setup

### 1. Environment Variables

Add these to both apps' `.env.local` files:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: For server-side operations with elevated permissions
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. Install Dependencies

The package automatically installs when you add it to your app's dependencies:

```json
{
  "dependencies": {
    "@repo/supabase": "workspace:*"
  }
}
```

## Usage

### Client-Side (React Components)

```typescript
import { createClient } from '@repo/supabase/client';

// In a React component
function MyComponent() {
  const [data, setData] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('your_table')
        .select('*');
      
      if (error) {
        console.error('Error:', error);
        return;
      }
      
      setData(data);
    }

    fetchData();
  }, []);

  return <div>{/* Your component */}</div>;
}
```

### Server-Side (Next.js Server Components & API Routes)

```typescript
import { createClient } from '@repo/supabase/server';

// In a Server Component
export default async function ServerComponent() {
  const supabase = await createClient();
  const { data } = await supabase.from('your_table').select('*');

  return <div>{/* Render your data */}</div>;
}

// In an API Route
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('your_table').select('*');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
```

## Available Exports

### Client-Side
- `supabase` - Pre-configured Supabase client for browser use
- `getCurrentUser()` - Get the current authenticated user
- `signOut()` - Sign out the current user
- `fetchData<T>()` - Generic data fetching with error handling
- `handleSupabaseError()` - Error handling utility

### Server-Side
- `createServerClient()` - Create a server-side Supabase client

### Types
- `Database` - TypeScript interface for your database schema

## TypeScript Types

Generate types from your Supabase schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/supabase/src/types/database.ts
```

## Best Practices

1. **Use client exports in React components**
2. **Use server exports in Server Components and API routes**
3. **Always handle errors appropriately**
4. **Generate TypeScript types from your schema**
5. **Use environment variables for configuration**

## Troubleshooting

### "Missing Supabase environment variables"
- Verify your `.env.local` files exist and have the correct variables
- Make sure variable names start with `NEXT_PUBLIC_` for client-side access

### TypeScript errors
- Run `pnpm install` to ensure peer dependencies are resolved
- Generate fresh types from your Supabase schema 