const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-large';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Proactive rate limiter: enforces minimum gap between Voyage API calls.
// Free tier = 3 RPM → 21s gap. Standard tier (payment added) = no meaningful delay needed.
let lastCallAt = 0;
const MIN_GAP_MS = 21000;

async function rateLimitedFetch(texts: string[]): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (lastCallAt > 0 && elapsed < MIN_GAP_MS) {
    await sleep(MIN_GAP_MS - elapsed);
  }
  lastCallAt = Date.now();
  return fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
  });
}

export async function embedBatch(texts: string[], retries = 5): Promise<number[][]> {
  if (texts.length === 0) return [];

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await rateLimitedFetch(texts);

    if (response.status === 429) {
      const waitMs = Math.min(21000 * (attempt + 1), 300000);
      console.log(`  Voyage rate limit — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${retries})`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Voyage API error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }

  throw new Error(`Voyage API failed after ${retries} retries — add a payment method at dashboard.voyageai.com to unlock standard rate limits`);
}
