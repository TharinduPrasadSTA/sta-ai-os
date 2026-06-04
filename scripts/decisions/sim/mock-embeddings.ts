// Deterministic embeddings — same text always produces same vector
export function mockEmbed(text: string, _type?: string): Promise<number[]> {
  const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const vec = Array.from({ length: 1024 }, (_, i) => Math.sin(seed + i) * 0.1);
  return Promise.resolve(vec);
}

export function mockEmbedBatch(texts: string[], _type?: string): Promise<number[][]> {
  return Promise.resolve(texts.map((t) => mockEmbed(t).then(() => t)).map((_, i) => {
    const seed = texts[i].split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 1024 }, (_, j) => Math.sin(seed + j) * 0.1);
  }));
}
