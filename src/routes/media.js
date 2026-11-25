// Uploaded product photos.
//
// Photos are shrunk in the browser (admin screen) and stored as rows in the
// free D1 database, so no paid storage or card registration is needed.
// To move to R2 later, only this file changes: saveMedia() writes to the
// bucket and the GET route reads from it; the /media/<id> URLs stay the same.

import { Hono } from 'hono';

export const MAX_UPLOAD_BYTES = 1_800_000; // D1 allows about 2 MB per row
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

export async function saveMedia(db, contentType, buffer) {
  if (!ALLOWED_TYPES.includes(contentType)) {
    return { error: '지원하지 않는 이미지 형식입니다 (WebP, JPEG, PNG만 가능).' };
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { error: '이미지 용량이 너무 큽니다 (최대 약 1.8MB).' };
  }
  const id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await db
    .prepare('INSERT INTO media (id, content_type, data, size, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, contentType, buffer, buffer.byteLength, new Date().toISOString())
    .run();
  return { url: `/media/${id}` };
}

/** Removes uploads that no product or setting points to any more (older than an hour). */
export function sweepMediaStatement(db) {
  const cutoff = new Date(Date.now() - 3_600_000).toISOString();
  return db
    .prepare(
      `DELETE FROM media
       WHERE created_at < ?
         AND '/media/' || id NOT IN (SELECT url FROM product_images)
         AND '/media/' || id NOT IN (SELECT value FROM settings WHERE key = 'hero_image')`,
    )
    .bind(cutoff);
}

const media = new Hono();

media.get('/media/:id', async (c) => {
  const cache = caches.default;
  const cached = await cache.match(c.req.raw);
  if (cached) return cached;

  const row = await c.env.DB.prepare('SELECT content_type, data FROM media WHERE id = ?')
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.notFound();

  const bytes = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
  const response = new Response(bytes, {
    headers: {
      'Content-Type': row.content_type,
      // An upload never changes (a new photo gets a new id), so cache it for a year.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()));
  return response;
});

export default media;
