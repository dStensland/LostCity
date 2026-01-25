---
description: Create or modify a Next.js API route
---

# API Route Task

$ARGUMENTS

## Location

Routes go in `web/app/api/`

## Structure
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('table').select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
```

## Conventions

- Use `route.ts` with HTTP method exports
- Use `createClient()` from `@/lib/supabase/server`
- Return consistent error shapes
- Check auth for protected routes
