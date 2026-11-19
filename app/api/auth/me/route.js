import { getSession } from '@/lib/auth.js';
import { handler, json } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await getSession();
  return json({ user });
});
