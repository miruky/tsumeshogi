import './style.css';
import {
  PROBLEMS,
  N,
  idx,
  clonePosition,
  legalMoves,
  makeMove,
  isCheckmate,
  bestDefense,
  findMatingMove,
  isSolvingMove,
  parseHash,
  buildHash,
  serializeProgress,
  parseProgress,
} from './lib';
import type { Base, Move, Piece, Position, Side, Sq } from './lib';

const CELL = 48;
const PAD_TOP = 20;
const PAD_RIGHT = 18;
const SVGNS = 'http://www.w3.org/2000/svg';
const RANK_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEY_THEME = 'tsume-theme';
const KEY_SOLVED = 'tsume-solved';

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 保存できなくても続行 */
    }
  },
};

function glyph(p: Piece): string {
  if (p.promoted) {
    return { R: '龍', B: '馬', S: '全', N: '圭', L: '杏', P: 'と', G: '金', K: '玉' }[p.base];
  }
  return { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' }[p.base];
}

const HAND_ORDER: Array<Exclude<Base, 'K'>> = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
const HAND_GLYPH: Record<Exclude<Base, 'K'>, string> = {
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
};
const PIECE_NAME: Record<Base, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
};

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function cx(c: number): number {
  return c * CELL + CELL / 2;
}
function cyr(r: number): number {
  return PAD_TOP + r * CELL + CELL / 2;
}

/** 手を日本語の指し手表記にする。表示用。 */
function notate(pos: Position, m: Move, side: Side): string {
  const mark = side === 'b' ? '▲' : '△';
  const sq = `${9 - m.to.c}${RANK_KANJI[m.to.r]}`;
  if (m.drop) return `${mark}${sq}${PIECE_NAME[m.drop]}打`;
  const p = pos.board[idx(m.from!.r, m.from!.c)]!;
  return `${mark}${sq}${glyph(p)}${m.promote ? '成' : ''}`;
}

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" role="img" aria-labelledby="logo-title">
  <title id="logo-title">tsumeshogi</title>
  <path d="M32 7l21 7v6l-21-6-21 6v-6z" fill="var(--accent)" stroke="none"/>
  <path d="M32 17l17 5v12c0 12-7 19-17 23-10-4-17-11-17-23V22z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
  <text x="32" y="40" text-anchor="middle" font-size="22" font-family="serif" fill="currentColor">詰</text>
</svg>`;

function shell(): string {
  return `
<header class="site-header reveal">
  <div class="brand">
    ${LOGO}
    <div class="brand-text">
      <h1>tsumeshogi</h1>
      <p class="tagline">王手を続けて玉を詰ます</p>
    </div>
  </div>
  <div class="header-tools">
    <button id="theme" type="button" class="ghost" aria-label="表示テーマを切り替える">テーマ: 自動</button>
  </div>
</header>

<main class="layout">
  <section class="board-pane reveal" style="--d:1">
    <div class="hand gote" id="hand-gote"></div>
    <svg id="board" viewBox="0 0 ${9 * CELL + PAD_RIGHT} ${PAD_TOP + 9 * CELL + 2}"
         tabindex="0" role="application"
         aria-label="将棋盤。矢印キーで升を選び、Enterで駒を動かす。先手の駒を動かして詰みを目指す"></svg>
    <div class="hand sente" id="hand-sente"></div>
  </section>

  <aside class="side reveal" style="--d:2">
    <section class="study">
      <p class="kicker">出題</p>
      <h2 class="prob-title" id="p-title"></h2>
      <p class="prob-meta"><span id="p-meta"></span><span class="dot" id="p-state"></span></p>
      <p class="prob-note" id="p-note"></p>
    </section>

    <p class="message" id="message" aria-live="polite"></p>

    <section class="block">
      <p class="kicker">操作</p>
      <div class="controls">
        <button id="hint" type="button" class="ghost"><span class="k">H</span>ヒント</button>
        <button id="undo" type="button" class="ghost"><span class="k">U</span>待った</button>
        <button id="reset" type="button" class="ghost"><span class="k">R</span>初手から</button>
        <button id="answer" type="button" class="ghost"><span class="k">A</span>解答</button>
      </div>
      <div class="controls nav">
        <button id="prev" type="button" class="ghost">前の問題</button>
        <button id="next" type="button" class="solid"><span class="k">N</span>次の問題</button>
      </div>
    </section>

    <section class="block">
      <p class="kicker">指し手</p>
      <ol class="movelist" id="movelist"></ol>
      <button id="copy" type="button" class="link-btn" hidden>棋譜をコピー</button>
    </section>

    <section class="block">
      <div class="probs-head">
        <p class="kicker">問題</p>
        <p class="progress-label"><span id="solved-count">0</span> / ${PROBLEMS.length} 解答</p>
      </div>
      <svg class="meter" id="meter" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
        <rect class="meter-bg" x="0" y="0" width="100" height="4" rx="2" />
        <rect class="meter-fill" id="meter-fill" x="0" y="0" width="0" height="4" rx="2" />
      </svg>
      <ul class="probs" id="probs"></ul>
    </section>
  </aside>
</main>

<footer class="site-footer reveal" style="--d:3">
  <p>駒をクリック、または矢印キーで選び Enter で動かす。王手を続けて詰みを目指す。</p>
  <p class="legend">
    <kbd>H</kbd> ヒント<kbd>U</kbd> 待った<kbd>R</kbd> 初手<kbd>A</kbd> 解答<kbd>N</kbd> 次<kbd>T</kbd> テーマ
  </p>
  <a href="https://github.com/miruky/tsumeshogi" class="src-link">ソース</a>
</footer>

<div class="promo-overlay" id="promo" role="dialog" aria-modal="true" aria-labelledby="promo-q">
  <div class="promo-box">
    <p id="promo-q">成りますか?</p>
    <div class="row">
      <button id="promo-yes" type="button" class="solid">成る</button>
      <button id="promo-no" type="button" class="ghost">不成</button>
    </div>
  </div>
</div>`;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`要素が見つからない: ${id}`);
  return node as T;
}

type Selection = { kind: 'board'; sq: Sq } | { kind: 'drop'; base: Exclude<Base, 'K'> } | null;

/** 待った用に、攻め方の一手を指す直前の状態を覚えておく。 */
interface Snapshot {
  pos: Position;
  movesLeft: number;
  logLen: number;
  lastMove: Move | null;
}

class Trainer {
  private probIndex = 0;
  private pos: Position = clonePosition(PROBLEMS[0]!.position);
  private movesLeft = PROBLEMS[0]!.moves;
  private status: 'solving' | 'solved' = 'solving';
  private selection: Selection = null;
  private lastMove: Move | null = null;
  private hintTo: Sq | null = null;
  private log: string[] = [];
  private locked = false;
  private history: Snapshot[] = [];
  private solved = new Set<string>(
    parseProgress(
      store.get(KEY_SOLVED),
      PROBLEMS.map((p) => p.id),
    ),
  );
  private cursor: Sq = { r: 0, c: 4 };
  private cursorShown = false;

  private board = el<HTMLElement>('board') as unknown as SVGSVGElement;
  private bgLayer = svg('g');
  private markLayer = svg('g');
  private pieceLayer = svg('g');
  private promoResolver: ((promote: boolean) => void) | null = null;

  constructor() {
    this.buildBoardStatic();
    this.board.append(this.bgLayer, this.markLayer, this.pieceLayer);
    this.bind();
    const fromHash = parseHash(location.hash);
    const start = Math.max(
      0,
      PROBLEMS.findIndex((p) => p.id === fromHash),
    );
    this.loadProblem(start, false);
  }

  private get problem() {
    return PROBLEMS[this.probIndex]!;
  }

  private buildBoardStatic(): void {
    this.bgLayer.appendChild(
      svg('rect', { class: 'board-bg', x: 0, y: PAD_TOP, width: 9 * CELL, height: 9 * CELL }),
    );
    for (let i = 0; i <= 9; i++) {
      this.bgLayer.appendChild(
        svg('line', {
          class: 'board-grid',
          x1: i * CELL,
          y1: PAD_TOP,
          x2: i * CELL,
          y2: PAD_TOP + 9 * CELL,
        }),
      );
      this.bgLayer.appendChild(
        svg('line', {
          class: 'board-grid',
          x1: 0,
          y1: PAD_TOP + i * CELL,
          x2: 9 * CELL,
          y2: PAD_TOP + i * CELL,
        }),
      );
    }
    const stars: Array<[number, number]> = [
      [3, 3],
      [3, 6],
      [6, 3],
      [6, 6],
    ];
    for (const [r, c] of stars) {
      this.bgLayer.appendChild(
        svg('circle', { class: 'board-star', cx: c * CELL, cy: PAD_TOP + r * CELL, r: 2.4 }),
      );
    }
    this.bgLayer.appendChild(
      svg('rect', { class: 'board-frame', x: 0, y: PAD_TOP, width: 9 * CELL, height: 9 * CELL }),
    );
    for (let c = 0; c < 9; c++) {
      const t = svg('text', { class: 'coord', x: cx(c), y: PAD_TOP - 7 });
      t.textContent = String(9 - c);
      this.bgLayer.appendChild(t);
    }
    for (let r = 0; r < 9; r++) {
      const t = svg('text', { class: 'coord', x: 9 * CELL + 9, y: cyr(r) + 4 });
      t.textContent = RANK_KANJI[r]!;
      this.bgLayer.appendChild(t);
    }
  }

  private loadProblem(i: number, pushHash = true): void {
    this.probIndex = i;
    this.pos = clonePosition(this.problem.position);
    this.movesLeft = this.problem.moves;
    this.status = 'solving';
    this.selection = null;
    this.lastMove = null;
    this.hintTo = null;
    this.log = [];
    this.locked = false;
    this.history = [];
    this.cursor = this.defaultCursor();
    if (pushHash) this.syncHash();
    this.setMessage('', '');
    this.render();
  }

  private defaultCursor(): Sq {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.pos.board[idx(r, c)];
        if (p && p.side === 'w' && p.base === 'K') return { r: Math.min(r + 1, N - 1), c };
      }
    }
    return { r: 0, c: 4 };
  }

  private syncHash(): void {
    const want = buildHash(this.problem.id);
    if (location.hash !== want) history.replaceState(null, '', want);
  }

  private setMessage(text: string, cls: '' | 'good' | 'bad'): void {
    const m = el('message');
    m.textContent = text;
    m.className = `message ${cls}`;
  }

  // --- 描画 -----------------------------------------------------------------

  private render(): void {
    this.renderMarks();
    this.renderPieces();
    this.renderHands();
    this.renderSide();
  }

  private candidateDests(): Sq[] {
    if (!this.selection) return [];
    const out: Sq[] = [];
    const seen = new Set<string>();
    for (const m of legalMoves(this.pos)) {
      const match =
        this.selection.kind === 'board'
          ? !!m.from && m.from.r === this.selection.sq.r && m.from.c === this.selection.sq.c
          : m.drop === this.selection.base;
      if (!match) continue;
      const key = `${m.to.r},${m.to.c}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m.to);
      }
    }
    return out;
  }

  private cell(cls: string, sq: Sq, extra: Record<string, string | number> = {}) {
    return svg('rect', {
      class: cls,
      x: sq.c * CELL,
      y: PAD_TOP + sq.r * CELL,
      width: CELL,
      height: CELL,
      ...extra,
    });
  }

  private renderMarks(): void {
    this.markLayer.replaceChildren();
    if (this.lastMove) this.markLayer.appendChild(this.cell('mark-last', this.lastMove.to));
    if (this.selection?.kind === 'board') {
      this.markLayer.appendChild(this.cell('mark-pick', this.selection.sq));
    }
    for (const d of this.candidateDests()) {
      this.markLayer.appendChild(
        svg('circle', { class: 'mark-dest', cx: cx(d.c), cy: cyr(d.r), r: 7 }),
      );
    }
    if (this.hintTo) {
      this.markLayer.appendChild(
        svg('circle', {
          class: 'mark-dest hint',
          cx: cx(this.hintTo.c),
          cy: cyr(this.hintTo.r),
          r: 11,
        }),
      );
    }
    if (this.cursorShown) {
      this.markLayer.appendChild(this.cell('mark-cursor', this.cursor, { rx: 2 }));
    }
  }

  private renderPieces(): void {
    this.pieceLayer.replaceChildren();
    const hw = CELL * 0.34;
    const sw = CELL * 0.22;
    const apex = -CELL * 0.42;
    const sh = -CELL * 0.22;
    const bot = CELL * 0.42;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.pos.board[idx(r, c)];
        if (!p) continue;
        const isNew = !!this.lastMove && this.lastMove.to.r === r && this.lastMove.to.c === c;
        const g = svg('g', {
          class: `koma ${p.side === 'w' ? 'gote' : 'sente'}${isNew ? ' placing' : ''}`,
          transform: `translate(${cx(c)} ${cyr(r)}) rotate(${p.side === 'w' ? 180 : 0})`,
        });
        g.appendChild(
          svg('path', {
            class: 'koma-shape',
            d: `M0 ${apex} L${sw} ${sh} L${hw} ${bot} L${-hw} ${bot} L${-sw} ${sh} Z`,
          }),
        );
        const t = svg('text', {
          class: `koma-text${p.promoted ? ' promoted' : ''}`,
          x: 0,
          y: CELL * 0.07,
        });
        t.textContent = glyph(p);
        g.appendChild(t);
        this.pieceLayer.appendChild(g);
      }
    }
  }

  private renderHands(): void {
    this.renderHand('hand-sente', 'b', '先手');
    this.renderHand('hand-gote', 'w', '後手');
  }

  private renderHand(id: string, side: Side, label: string): void {
    const box = el(id);
    box.replaceChildren();
    const tag = document.createElement('span');
    tag.className = 'label';
    tag.textContent = `${label}持駒`;
    box.appendChild(tag);
    const hand = this.pos.hands[side];
    let any = false;
    for (const base of HAND_ORDER) {
      const count = hand[base];
      if (count <= 0) continue;
      any = true;
      const span = document.createElement('span');
      const selectable = side === 'b' && this.status === 'solving' && !this.locked;
      const selected = this.selection?.kind === 'drop' && this.selection.base === base;
      span.className = `hand-piece${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}`;
      span.innerHTML = `${HAND_GLYPH[base]}${count > 1 ? `<span class="count">${count}</span>` : ''}`;
      if (selectable) {
        span.setAttribute('role', 'button');
        span.setAttribute('tabindex', '0');
        span.setAttribute('aria-label', `${PIECE_NAME[base]}を打つ`);
        span.addEventListener('click', () => this.selectDrop(base));
        span.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.selectDrop(base);
          }
        });
      }
      box.appendChild(span);
    }
    if (!any) {
      const none = document.createElement('span');
      none.className = 'empty';
      none.textContent = 'なし';
      box.appendChild(none);
    }
  }

  private renderSide(): void {
    el('p-title').textContent = this.problem.title;
    el('p-meta').textContent = `${this.problem.moves}手詰`;
    el('p-note').textContent = this.problem.note ?? '';
    const state = el('p-state');
    const done = this.solved.has(this.problem.id);
    state.textContent = done ? '解答済み' : '未解答';
    state.className = `dot ${done ? 'is-done' : ''}`;

    const ml = el('movelist');
    ml.replaceChildren();
    this.log.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'mv';
      li.textContent = s;
      ml.appendChild(li);
    });
    el<HTMLButtonElement>('copy').hidden = this.log.length === 0;

    const count = el('solved-count');
    count.textContent = String(this.solved.size);
    document
      .getElementById('meter-fill')
      ?.setAttribute('width', String((this.solved.size / PROBLEMS.length) * 100));

    const list = el('probs');
    list.replaceChildren();
    PROBLEMS.forEach((p, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'prob' + (i === this.probIndex ? ' current' : '') + (this.solved.has(p.id) ? ' done' : '');
      btn.style.setProperty('--i', String(i));
      btn.setAttribute('aria-current', i === this.probIndex ? 'true' : 'false');
      btn.innerHTML = `<span class="pt">${p.title}</span><span class="te">${p.moves}手</span>`;
      btn.addEventListener('click', () => this.loadProblem(i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    el<HTMLButtonElement>('hint').disabled = this.status !== 'solving' || this.locked;
    el<HTMLButtonElement>('answer').disabled = this.status !== 'solving' || this.locked;
    el<HTMLButtonElement>('undo').disabled = this.history.length === 0 || this.locked;
  }

  // --- 操作 -----------------------------------------------------------------

  private cellFromEvent(e: MouseEvent): Sq | null {
    const rect = this.board.getBoundingClientRect();
    const vbW = 9 * CELL + PAD_RIGHT;
    const vbH = PAD_TOP + 9 * CELL + 2;
    const x = ((e.clientX - rect.left) / rect.width) * vbW;
    const y = ((e.clientY - rect.top) / rect.height) * vbH;
    const c = Math.floor(x / CELL);
    const r = Math.floor((y - PAD_TOP) / CELL);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r, c };
  }

  private selectDrop(base: Exclude<Base, 'K'>): void {
    if (this.locked || this.status !== 'solving') return;
    this.hintTo = null;
    this.selection =
      this.selection?.kind === 'drop' && this.selection.base === base
        ? null
        : { kind: 'drop', base };
    this.render();
  }

  private onCell(sq: Sq): void {
    if (this.locked || this.status !== 'solving') return;
    this.hintTo = null;
    const isDest = this.candidateDests().some((d) => d.r === sq.r && d.c === sq.c);
    if (this.selection && isDest) {
      void this.chooseAndApply(sq);
      return;
    }
    const p = this.pos.board[idx(sq.r, sq.c)];
    this.selection = p && p.side === 'b' ? { kind: 'board', sq } : null;
    this.render();
  }

  private async chooseAndApply(to: Sq): Promise<void> {
    const sel = this.selection!;
    const matches = legalMoves(this.pos).filter((m) => {
      const selMatch =
        sel.kind === 'board'
          ? !!m.from && m.from.r === sel.sq.r && m.from.c === sel.sq.c
          : m.drop === sel.base;
      return selMatch && m.to.r === to.r && m.to.c === to.c;
    });
    let move = matches[0]!;
    if (matches.length > 1) {
      const promote = await this.askPromotion();
      move = matches.find((m) => !!m.promote === promote) ?? matches[0]!;
    }
    this.applyUserMove(move);
  }

  private askPromotion(): Promise<boolean> {
    el('promo').classList.add('show');
    el<HTMLButtonElement>('promo-yes').focus();
    return new Promise((resolve) => {
      this.promoResolver = resolve;
    });
  }

  private applyUserMove(move: Move): void {
    if (!isSolvingMove(this.pos, move, this.movesLeft)) {
      this.selection = null;
      this.setMessage('その手では詰みません。王手で追い詰めましょう。', 'bad');
      this.render();
      return;
    }
    this.history.push({
      pos: clonePosition(this.pos),
      movesLeft: this.movesLeft,
      logLen: this.log.length,
      lastMove: this.lastMove,
    });
    this.log.push(notate(this.pos, move, 'b'));
    this.pos = makeMove(this.pos, move);
    this.movesLeft -= 1;
    this.lastMove = move;
    this.selection = null;

    if (isCheckmate(this.pos)) {
      this.status = 'solved';
      this.markSolved();
      this.setMessage('詰み。正解です。', 'good');
      this.render();
      return;
    }
    this.setMessage('王手。相手の応手を読みます。', '');
    this.render();
    this.locked = true;
    window.setTimeout(() => this.defenderReply(), reduceMotion ? 0 : 480);
  }

  private markSolved(): void {
    if (!this.solved.has(this.problem.id)) {
      this.solved.add(this.problem.id);
      store.set(KEY_SOLVED, serializeProgress(this.solved));
    }
  }

  private defenderReply(): void {
    const def = bestDefense(this.pos, this.movesLeft - 1);
    if (def) {
      this.log.push(notate(this.pos, def, 'w'));
      this.pos = makeMove(this.pos, def);
      this.movesLeft -= 1;
      this.lastMove = def;
    }
    this.locked = false;
    this.setMessage('続けて詰ましてください。', '');
    this.render();
  }

  private undo(): void {
    if (this.locked || this.history.length === 0) return;
    const snap = this.history.pop()!;
    this.pos = snap.pos;
    this.movesLeft = snap.movesLeft;
    this.lastMove = snap.lastMove;
    this.log.length = snap.logLen;
    this.status = 'solving';
    this.selection = null;
    this.hintTo = null;
    this.setMessage('一手戻しました。', '');
    this.render();
  }

  private hint(): void {
    if (this.locked || this.status !== 'solving') return;
    const m = findMatingMove(this.pos, this.movesLeft);
    if (!m) {
      this.setMessage('この局面に詰みは見つかりません。', 'bad');
      return;
    }
    this.selection = m.drop ? { kind: 'drop', base: m.drop } : { kind: 'board', sq: m.from! };
    this.hintTo = m.to;
    this.setMessage(`ヒント: ${notate(this.pos, m, 'b')} のあたり。`, '');
    this.render();
  }

  private async showAnswer(): Promise<void> {
    if (this.locked || this.status !== 'solving') return;
    this.locked = true;
    this.selection = null;
    this.hintTo = null;
    const step = reduceMotion ? 0 : 520;
    while (this.movesLeft > 0) {
      const m = findMatingMove(this.pos, this.movesLeft);
      if (!m) break;
      this.log.push(notate(this.pos, m, 'b'));
      this.pos = makeMove(this.pos, m);
      this.movesLeft -= 1;
      this.lastMove = m;
      this.render();
      if (isCheckmate(this.pos)) break;
      await this.pause(step);
      const def = bestDefense(this.pos, this.movesLeft - 1);
      if (!def) break;
      this.log.push(notate(this.pos, def, 'w'));
      this.pos = makeMove(this.pos, def);
      this.movesLeft -= 1;
      this.lastMove = def;
      this.render();
      await this.pause(step);
    }
    this.status = 'solved';
    this.locked = false;
    this.history = [];
    this.setMessage('解答を表示しました。', '');
    this.render();
  }

  private async copyKifu(): Promise<void> {
    if (this.log.length === 0) return;
    const text = [`${this.problem.title}(${this.problem.moves}手詰)`]
      .concat(this.log.map((s, i) => `${i + 1}. ${s}`))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.setMessage('棋譜をコピーしました。', 'good');
    } catch {
      this.setMessage('コピーできませんでした。', 'bad');
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  private moveCursor(dr: number, dc: number): void {
    this.cursorShown = true;
    this.cursor = {
      r: Math.min(N - 1, Math.max(0, this.cursor.r + dr)),
      c: Math.min(N - 1, Math.max(0, this.cursor.c + dc)),
    };
    this.renderMarks();
  }

  private bind(): void {
    this.board.addEventListener('click', (e) => {
      const sq = this.cellFromEvent(e);
      if (sq) this.onCell(sq);
    });
    this.board.addEventListener('focus', () => {
      this.cursorShown = true;
      this.renderMarks();
    });
    this.board.addEventListener('blur', () => {
      this.cursorShown = false;
      this.renderMarks();
    });
    this.board.addEventListener('keydown', (e) => this.onBoardKey(e));

    el<HTMLButtonElement>('hint').addEventListener('click', () => this.hint());
    el<HTMLButtonElement>('undo').addEventListener('click', () => this.undo());
    el<HTMLButtonElement>('reset').addEventListener('click', () =>
      this.loadProblem(this.probIndex, false),
    );
    el<HTMLButtonElement>('answer').addEventListener('click', () => void this.showAnswer());
    el<HTMLButtonElement>('prev').addEventListener('click', () => this.step(-1));
    el<HTMLButtonElement>('next').addEventListener('click', () => this.step(1));
    el<HTMLButtonElement>('copy').addEventListener('click', () => void this.copyKifu());
    el<HTMLButtonElement>('theme').addEventListener('click', () => cycleTheme());
    el<HTMLButtonElement>('promo-yes').addEventListener('click', () => this.resolvePromo(true));
    el<HTMLButtonElement>('promo-no').addEventListener('click', () => this.resolvePromo(false));

    window.addEventListener('hashchange', () => {
      const id = parseHash(location.hash);
      const i = PROBLEMS.findIndex((p) => p.id === id);
      if (i >= 0 && i !== this.probIndex) this.loadProblem(i, false);
    });
    document.addEventListener('keydown', (e) => this.onGlobalKey(e));
  }

  private step(delta: number): void {
    const n = PROBLEMS.length;
    this.loadProblem((this.probIndex + delta + n) % n);
  }

  private onBoardKey(e: KeyboardEvent): void {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (map[e.key]) {
      e.preventDefault();
      this.moveCursor(map[e.key]![0], map[e.key]![1]);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.cursorShown = true;
      this.onCell(this.cursor);
    }
  }

  private onGlobalKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (el('promo').classList.contains('show')) {
      if (e.key === 'Escape') this.resolvePromo(false);
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    switch (e.key.toLowerCase()) {
      case 'h':
        this.hint();
        break;
      case 'u':
        this.undo();
        break;
      case 'r':
        this.loadProblem(this.probIndex, false);
        break;
      case 'a':
        void this.showAnswer();
        break;
      case 'n':
        this.step(1);
        break;
      case 'p':
        this.step(-1);
        break;
      case 't':
        cycleTheme();
        break;
      case 'escape':
        this.selection = null;
        this.hintTo = null;
        this.render();
        break;
      default:
        return;
    }
  }

  private resolvePromo(promote: boolean): void {
    el('promo').classList.remove('show');
    const r = this.promoResolver;
    this.promoResolver = null;
    if (r) r(promote);
  }
}

type ThemeMode = 'auto' | 'light' | 'dark';

function cycleTheme(): void {
  const order: ThemeMode[] = ['auto', 'light', 'dark'];
  const cur = (store.get(KEY_THEME) as ThemeMode) || 'auto';
  const next = order[(order.indexOf(cur) + 1) % order.length]!;
  store.set(KEY_THEME, next);
  applyTheme(next);
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const btn = document.getElementById('theme');
  if (btn) btn.textContent = `テーマ: ${{ auto: '自動', light: '明', dark: '暗' }[mode]}`;
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = shell();
  applyTheme((store.get(KEY_THEME) as ThemeMode) || 'auto');
  new Trainer();
}

boot();
