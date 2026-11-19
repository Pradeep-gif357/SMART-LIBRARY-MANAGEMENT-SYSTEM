import { getRecommendations } from '@/lib/recommend.js';
import { handler, json, requireUser } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const me = await requireUser();
  return json(await getRecommendations(me.user_id));
});
