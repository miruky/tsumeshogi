import type { Base, Hand, Move, Piece, Position, Side, Sq } from './types';

export const N = 9;

export function idx(r: number, c: number): number {
  return r * N + c;
}

export function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < N && c >= 0 && c < N;
}

export function emptyHand(): Hand {
  return { R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 };
}

export function cloneHand(h: Hand): Hand {
  return { R: h.R, B: h.B, G: h.G, S: h.S, N: h.N, L: h.L, P: h.P };
}

export function clonePosition(p: Position): Position {
  return {
    board: p.board.slice(),
    hands: { b: cloneHand(p.hands.b), w: cloneHand(p.hands.w) },
    turn: p.turn,
  };
}

export function opponent(side: Side): Side {
  return side === 'b' ? 'w' : 'b';
}

function forward(side: Side): number {
  // 先手は上(段が小さくなる方向)へ進む。
  return side === 'b' ? -1 : 1;
}

const KING_STEPS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function goldSteps(side: Side): Array<[number, number]> {
  const f = forward(side);
  return [
    [f, 0],
    [f, -1],
    [f, 1],
    [0, -1],
    [0, 1],
    [-f, 0],
  ];
}

interface Vectors {
  steps: Array<[number, number]>;
  slides: Array<[number, number]>;
}

const DIAG: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const ORTHO: ReadonlyArray<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** 駒の動き(歩み=steps、走り=slides)を相対ベクトルで返す。 */
function vectors(p: Piece): Vectors {
  const f = forward(p.side);
  if (p.base === 'K') return { steps: [...KING_STEPS], slides: [] };
  if (p.base === 'G') return { steps: goldSteps(p.side), slides: [] };
  if (p.promoted && (p.base === 'P' || p.base === 'L' || p.base === 'N' || p.base === 'S')) {
    return { steps: goldSteps(p.side), slides: [] };
  }
  switch (p.base) {
    case 'P':
      return { steps: [[f, 0]], slides: [] };
    case 'L':
      return { steps: [], slides: [[f, 0]] };
    case 'N':
      return {
        steps: [
          [2 * f, -1],
          [2 * f, 1],
        ],
        slides: [],
      };
    case 'S':
      return {
        steps: [
          [f, 0],
          [f, -1],
          [f, 1],
          [-f, -1],
          [-f, 1],
        ],
        slides: [],
      };
    case 'B':
      return { steps: p.promoted ? [...ORTHO] : [], slides: [...DIAG] };
    case 'R':
      return { steps: p.promoted ? [...DIAG] : [], slides: [...ORTHO] };
    default:
      return { steps: [], slides: [] };
  }
}

/** (r,c)の駒の擬似的な利き先(自玉の安全は考慮しない)。 */
export function destinationsFrom(pos: Position, r: number, c: number): Sq[] {
  const p = pos.board[idx(r, c)];
  if (!p) return [];
  const out: Sq[] = [];
  const { steps, slides } = vectors(p);
  for (const [dr, dc] of steps) {
    const nr = r + dr;
    const nc = c + dc;
    if (!onBoard(nr, nc)) continue;
    const t = pos.board[idx(nr, nc)];
    if (!t || t.side !== p.side) out.push({ r: nr, c: nc });
  }
  for (const [dr, dc] of slides) {
    let nr = r + dr;
    let nc = c + dc;
    while (onBoard(nr, nc)) {
      const t = pos.board[idx(nr, nc)];
      if (!t) {
        out.push({ r: nr, c: nc });
      } else {
        if (t.side !== p.side) out.push({ r: nr, c: nc });
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return out;
}

/** (tr,tc)が side の駒に利いているか。 */
export function isAttacked(pos: Position, tr: number, tc: number, side: Side): boolean {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = pos.board[idx(r, c)];
      if (!p || p.side !== side) continue;
      for (const d of destinationsFrom(pos, r, c)) {
        if (d.r === tr && d.c === tc) return true;
      }
    }
  }
  return false;
}

export function kingSquare(pos: Position, side: Side): Sq | null {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = pos.board[idx(r, c)];
      if (p && p.side === side && p.base === 'K') return { r, c };
    }
  }
  return null;
}

export function inCheck(pos: Position, side: Side): boolean {
  const k = kingSquare(pos, side);
  if (!k) return false;
  return isAttacked(pos, k.r, k.c, opponent(side));
}

function lastRank(side: Side): number {
  return side === 'b' ? 0 : N - 1;
}

function inPromoZone(side: Side, r: number): boolean {
  return side === 'b' ? r <= 2 : r >= N - 3;
}

function isPromotable(p: Piece): boolean {
  return !p.promoted && p.base !== 'G' && p.base !== 'K';
}

/** その段に進むと動けなくなる駒は必ず成る。 */
function mustPromote(p: Piece, toR: number): boolean {
  if (p.promoted) return false;
  if (p.base === 'P' || p.base === 'L') return toR === lastRank(p.side);
  if (p.base === 'N') return toR === lastRank(p.side) || toR === lastRank(p.side) + forward(p.side);
  return false;
}

/** 局面に手を適用し、新しい局面を返す(元は変更しない)。 */
export function makeMove(pos: Position, m: Move): Position {
  const np = clonePosition(pos);
  const side = pos.turn;
  if (m.drop) {
    np.hands[side][m.drop] -= 1;
    np.board[idx(m.to.r, m.to.c)] = { base: m.drop, side, promoted: false };
  } else if (m.from) {
    const p = np.board[idx(m.from.r, m.from.c)]!;
    const captured = np.board[idx(m.to.r, m.to.c)];
    if (captured && captured.base !== 'K') np.hands[side][captured.base] += 1;
    np.board[idx(m.from.r, m.from.c)] = null;
    np.board[idx(m.to.r, m.to.c)] = {
      base: p.base,
      side,
      promoted: p.promoted || !!m.promote,
    };
  }
  np.turn = opponent(side);
  return np;
}

function ownPawnInColumn(pos: Position, side: Side, c: number): boolean {
  for (let r = 0; r < N; r++) {
    const p = pos.board[idx(r, c)];
    if (p && p.side === side && p.base === 'P' && !p.promoted) return true;
  }
  return false;
}

/** その手番の合法手をすべて列挙する(自玉が王手に晒される手・反則手は除く)。 */
export function legalMoves(pos: Position): Move[] {
  const side = pos.turn;
  const candidates: Move[] = [];

  // 盤上の駒の移動
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = pos.board[idx(r, c)];
      if (!p || p.side !== side) continue;
      for (const to of destinationsFrom(pos, r, c)) {
        const from = { r, c };
        if (mustPromote(p, to.r)) {
          candidates.push({ from, to, promote: true });
        } else {
          candidates.push({ from, to });
          if (isPromotable(p) && (inPromoZone(side, r) || inPromoZone(side, to.r))) {
            candidates.push({ from, to, promote: true });
          }
        }
      }
    }
  }

  // 持ち駒を打つ
  const hand = pos.hands[side];
  const bases: Array<Exclude<Base, 'K'>> = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  for (const base of bases) {
    if (hand[base] <= 0) continue;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (pos.board[idx(r, c)]) continue;
        if ((base === 'P' || base === 'L') && r === lastRank(side)) continue;
        if (base === 'N' && (r === lastRank(side) || r === lastRank(side) + forward(side)))
          continue;
        if (base === 'P' && ownPawnInColumn(pos, side, c)) continue; // 二歩
        candidates.push({ to: { r, c }, drop: base });
      }
    }
  }

  // 自玉が王手に晒される手を除く。歩を打って詰ます手(打ち歩詰め)も除く。
  const legal: Move[] = [];
  for (const m of candidates) {
    const np = makeMove(pos, m);
    if (inCheck(np, side)) continue;
    if (m.drop === 'P' && isCheckmate(np)) continue; // 打ち歩詰め
    legal.push(m);
  }
  return legal;
}

/** 手番の側が王手されていて合法手が無い(詰み)か。 */
export function isCheckmate(pos: Position): boolean {
  if (!inCheck(pos, pos.turn)) return false;
  return legalMoves(pos).length === 0;
}

/** 手mが相手玉に王手をかけるか。 */
export function givesCheck(pos: Position, m: Move): boolean {
  const np = makeMove(pos, m);
  return inCheck(np, np.turn);
}

/** 配置の短い記法。[段, 筋, 所属, 駒, 成り?]。 */
export type Placement = [number, number, Side, Base, boolean?];

/** 配置と持ち駒から局面を組み立てる。問題定義やテストで使う。 */
export function buildPosition(
  places: Placement[],
  handB: Partial<Hand> = {},
  handW: Partial<Hand> = {},
  turn: Side = 'b',
): Position {
  const board: (Piece | null)[] = new Array(N * N).fill(null);
  for (const [r, c, side, base, promoted] of places) {
    board[idx(r, c)] = { base, side, promoted: !!promoted };
  }
  return {
    board,
    hands: { b: { ...emptyHand(), ...handB }, w: { ...emptyHand(), ...handW } },
    turn,
  };
}
