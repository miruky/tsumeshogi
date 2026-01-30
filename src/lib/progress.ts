// 解答の進捗とURL共有の符号化。DOM・localStorageから切り離した純関数にして、
// 保存形式とURL形式を単体テストできるようにする。

const HASH_KEY = 'p';

/** URLハッシュ(例: "#p=m3-hisha-kin")から問題IDを取り出す。無効なら null。 */
export function parseHash(hash: string): string | null {
  const body = hash.replace(/^#/, '');
  if (!body) return null;
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const val = part.slice(eq + 1);
    if (key === HASH_KEY && val) {
      try {
        return decodeURIComponent(val);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** 問題IDを共有用のハッシュ文字列にする。 */
export function buildHash(id: string): string {
  return `#${HASH_KEY}=${encodeURIComponent(id)}`;
}

/** 解答済みIDの集合をlocalStorage保存用の文字列にする。 */
export function serializeProgress(ids: Iterable<string>): string {
  return JSON.stringify([...new Set(ids)].sort());
}

/**
 * 保存文字列を解答済みIDの配列に戻す。壊れた値や未知のIDは捨て、
 * known で渡した実在するIDだけを残す。
 */
export function parseProgress(raw: string | null, known: Iterable<string>): string[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const valid = new Set(known);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (typeof item === 'string' && valid.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
