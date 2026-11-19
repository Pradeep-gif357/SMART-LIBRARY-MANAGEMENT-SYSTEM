import { destroySession } from '@/lib/auth.js';
import { handler, json } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const POST = handler(async () => {
  destroySession();
  return json({ ok: true });
});
