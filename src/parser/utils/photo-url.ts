const STATIC_THUMB_RE = /^https:\/\/static\.realt\.by\/thumb\/c\/\d+x\d+\/[a-f0-9]+\/(.+)\.jpe?g$/;
const CDN_THUMB_RE = /^https:\/\/cdn\.realt\.by\/img\/\d+\/([0-9a-f-]+)$/;

// realt.by отдаёт в GraphQL-поиске уменьшенные превью, оригиналы приходится
// строить руками из URL. Есть два вида:
//   1) static.realt.by/thumb/c/430x374/<hash>/<xx>/<x>/<unid>/<file>.jpeg
//      → static.realt.by/user/<xx>/<x>/<unid>/<file>.jpg
//   2) cdn.realt.by/img/55/<uuid>  (55 — размер, ~70КБ)
//      → cdn.realt.by/img/<uuid>   (без размера — оригинал ~800КБ+)
export function toOriginalPhoto(url: string): string {
  const s = STATIC_THUMB_RE.exec(url);
  if (s) return `https://static.realt.by/user/${s[1]}.jpg`;

  const c = CDN_THUMB_RE.exec(url);
  if (c) return `https://cdn.realt.by/img/${c[1]}`;

  return url;
}
