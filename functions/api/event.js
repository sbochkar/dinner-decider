const TYPES = ['result_shown', 'delivery_click', 'directions_click', 'website_click', 'call_click'];
const TARGETS = ['ubereats', 'doordash', 'skip'];
const PAGES = ['home', 'gems', 'partner'];
const MAX_BYTES = 1024;

const bad = () => new Response(null, { status: 400 });

// POST /api/event { type, target, page }  -> anonymous aggregate counter.
// Deliberately never reads IP, user-agent or cookies.
export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) return bad();
    data = JSON.parse(text);
  } catch {
    return bad();
  }
  if (!data || typeof data !== 'object') return bad();

  const { type, target = '', page } = data;
  if (!TYPES.includes(type)) return bad();
  if (typeof target !== 'string') return bad();
  if (type === 'delivery_click' ? !TARGETS.includes(target) : target !== '') return bad();

  try {
    env?.EVENTS?.writeDataPoint({
      blobs: [type, target, PAGES.includes(page) ? page : 'other'],
      doubles: [1],
      indexes: [type],
    });
  } catch {
    // Counting is best effort.
  }
  return new Response(null, { status: 204 });
}
