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
} from './lib';
import type { Base, Move, Piece, Position, Side, Sq } from './lib';

const CELL = 48;
const PAD_TOP = 20;
const PAD_RIGHT = 18;
const SVGNS = 'http://www.w3.org/2000/svg';
const RANK_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  <path d="M32 7l21 7v6l-21-6-21 6v-6z" fill="var(--logo-accent, #936417)" stroke="none"/>
  <path d="M32 17l17 5v12c0 12-7 19-17 23-10-4-17-11-17-23V22z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
  <text x="32" y="40" text-anchor="middle" font-size="22" font-family="serif" fill="currentColor">詰</text>
</svg>`;

function shell(): string {
  return `
<header class="site-header">
  <div class="brand">
    ${LOGO}
    <div>
      <h1>tsumeshogi</h1>
      <div class="tagline">王手を続けて玉を詰ます</div>
    </div>
  </div>
  <div class="header-tools">
    <button id="theme" type="button">テーマ: 自動</button>
  </div>
</header>

<main class="layout">
  <section class="pane board-pane">
    <div class="hand gote" id="hand-gote"></div>
    <svg id="board" viewBox="0 0 ${9 * CELL + PAD_RIGHT} ${PAD_TOP + 9 * CELL + 2}"
         role="application" aria-label="将棋盤。先手の駒を動かして詰みを目指す"></svg>
    <div class="hand sente" id="hand-sente"></div>
  </section>

  <aside class="pane side">
    <section class="prob-info">
      <div class="title" id="p-title"></div>
      <div class="meta" id="p-meta"></div>
      <div class="note" id="p-note"></div>
    </section>
    <p class="message" id="message" aria-live="polite"></p>
    <section>
      <h2>操作</h2>
      <div class="controls">
        <div class="row">
          <button id="hint" type="button">ヒント</button>
          <button id="reset" type="button">やり直す</button>
        </div>
        <div class="row">
          <button id="answer" type="button">答えを見る</button>
          <button id="next" type="button" class="primary">次の問題</button>
        </div>
      </div>
    </section>
    <section>
      <h2>指し手</h2>
      <div class="movelist" id="movelist"></div>
    </section>
    <section>
      <h2>問題</h2>
      <ul class="probs" id="probs"></ul>
    </section>
  </aside>
</main>

<footer class="site-footer">
  駒をクリックして動かす。持ち駒は選んでから盤の空きへ。王手を続けて詰みを目指す。
  <a href="https://github.com/miruky/tsumeshogi">ソース</a>
</footer>

<div class="promo-overlay" id="promo">
  <div class="promo-box">
    <p>成りますか?</p>
    <div class="row">
      <button id="promo-yes" type="button" class="primary">成る</button>
      <button id="promo-no" type="button">不成</button>
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
  private solved = new Set<string>();

  private board = el<HTMLElement>('board') as unknown as SVGSVGElement;
  private bgLayer = svg('g');
  private markLayer = svg('g');
  private pieceLayer = svg('g');
  private promoResolver: ((promote: boolean) => void) | null = null;

  constructor() {
    this.buildBoardStatic();
    this.board.append(this.bgLayer, this.markLayer, this.pieceLayer);
    this.bind();
    this.loadProblem(0);
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

  private loadProblem(i: number): void {
    this.probIndex = i;
    this.pos = clonePosition(this.problem.position);
    this.movesLeft = this.problem.moves;
    this.status = 'solving';
    this.selection = null;
    this.lastMove = null;
    this.hintTo = null;
    this.log = [];
    this.locked = false;
    this.setMessage('', '');
    this.render();
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

  private renderMarks(): void {
    this.markLayer.replaceChildren();
    if (this.lastMove) {
      const { r, c } = this.lastMove.to;
      this.markLayer.appendChild(
        svg('rect', {
          class: 'mark-last',
          x: c * CELL,
          y: PAD_TOP + r * CELL,
          width: CELL,
          height: CELL,
        }),
      );
    }
    if (this.selection?.kind === 'board') {
      const { r, c } = this.selection.sq;
      this.markLayer.appendChild(
        svg('rect', {
          class: 'mark-pick',
          x: c * CELL,
          y: PAD_TOP + r * CELL,
          width: CELL,
          height: CELL,
        }),
      );
    }
    for (const d of this.candidateDests()) {
      this.markLayer.appendChild(
        svg('circle', { class: 'mark-dest', cx: cx(d.c), cy: cyr(d.r), r: 7 }),
      );
    }
    if (this.hintTo) {
      this.markLayer.appendChild(
        svg('circle', { class: 'mark-dest', cx: cx(this.hintTo.c), cy: cyr(this.hintTo.r), r: 11 }),
      );
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
        const g = svg('g', {
          class: `koma ${p.side === 'w' ? 'gote' : 'sente'}`,
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

    const ml = el('movelist');
    ml.replaceChildren();
    this.log.forEach((s, i) => {
      const span = document.createElement('span');
      span.className = 'mv';
      span.textContent = `${i + 1}. ${s}`;
      ml.appendChild(span);
    });

    const list = el('probs');
    list.replaceChildren();
    PROBLEMS.forEach((p, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className =
        (i === this.probIndex ? 'current ' : '') + (this.solved.has(p.id) ? 'done' : '');
      btn.innerHTML = `<span>${p.title}</span><span class="te">${p.moves}手</span>`;
      btn.addEventListener('click', () => this.loadProblem(i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    el<HTMLButtonElement>('hint').disabled = this.status !== 'solving' || this.locked;
    el<HTMLButtonElement>('answer').disabled = this.status !== 'solving' || this.locked;
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
    this.log.push(notate(this.pos, move, 'b'));
    this.pos = makeMove(this.pos, move);
    this.movesLeft -= 1;
    this.lastMove = move;
    this.selection = null;

    if (isCheckmate(this.pos)) {
      this.status = 'solved';
      this.solved.add(this.problem.id);
      this.setMessage('詰み。正解です。', 'good');
      this.render();
      return;
    }
    this.setMessage('王手。相手の応手を読みます。', '');
    this.render();
    this.locked = true;
    window.setTimeout(() => this.defenderReply(), reduceMotion ? 0 : 480);
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
    this.setMessage('解答を表示しました。', '');
    this.render();
  }

  private pause(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  private bind(): void {
    this.board.addEventListener('click', (e) => {
      const sq = this.cellFromEvent(e);
      if (sq) this.onCell(sq);
    });
    el<HTMLButtonElement>('hint').addEventListener('click', () => this.hint());
    el<HTMLButtonElement>('reset').addEventListener('click', () =>
      this.loadProblem(this.probIndex),
    );
    el<HTMLButtonElement>('answer').addEventListener('click', () => void this.showAnswer());
    el<HTMLButtonElement>('next').addEventListener('click', () =>
      this.loadProblem((this.probIndex + 1) % PROBLEMS.length),
    );
    el<HTMLButtonElement>('theme').addEventListener('click', () => cycleTheme());
    el<HTMLButtonElement>('promo-yes').addEventListener('click', () => this.resolvePromo(true));
    el<HTMLButtonElement>('promo-no').addEventListener('click', () => this.resolvePromo(false));
  }

  private resolvePromo(promote: boolean): void {
    el('promo').classList.remove('show');
    const r = this.promoResolver;
    this.promoResolver = null;
    if (r) r(promote);
  }
}

function cycleTheme(): void {
  const order = ['auto', 'light', 'dark'] as const;
  const cur = (store.get('tsume-theme') as (typeof order)[number]) || 'auto';
  const next = order[(order.indexOf(cur) + 1) % order.length]!;
  store.set('tsume-theme', next);
  applyTheme(next);
}

function applyTheme(mode: 'auto' | 'light' | 'dark'): void {
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
  applyTheme((store.get('tsume-theme') as 'auto' | 'light' | 'dark') || 'auto');
  new Trainer();
}

boot();
