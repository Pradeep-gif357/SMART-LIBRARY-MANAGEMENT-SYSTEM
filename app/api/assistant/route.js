import { getSession } from '@/lib/auth.js';
import { answerQuestion } from '@/lib/assistant.js';
import { ApiError, handler, json, readJson } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// POST /api/assistant { message }  - works for guests too; logged-in users get personalised answers
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const message = String(body.message || '').trim();
  if (message.length < 2) throw new ApiError('Please type a question');
  if (message.length > 500) throw new ApiError('Please keep your question under 500 characters');

  const user = await getSession();
  return json(await answerQuestion(message, user));
});
