// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { PROBLEMS } from './lib';

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  // jsdomには matchMedia が無いので、reduced-motion問い合わせに応える最小実装を入れる。
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  }
  await import('./main');
});

describe('UI のDOM結線', () => {
  it('9x9の盤と駒を描画する', () => {
    const board = document.getElementById('board')!;
    // 玉(後手)が最初の問題に存在するので、玉の文字が盤上にある。
    const texts = Array.from(board.querySelectorAll('.koma-text'), (t) => t.textContent);
    expect(texts).toContain('玉');
    expect(board.querySelectorAll('.koma').length).toBeGreaterThanOrEqual(2);
  });

  it('最初の問題のタイトルと手数を表示する', () => {
    expect(document.getElementById('p-title')?.textContent).toBe(PROBLEMS[0]!.title);
    expect(document.getElementById('p-meta')?.textContent).toContain('手詰');
  });

  it('問題一覧に全問題を並べ、先頭が選択中', () => {
    const items = document.querySelectorAll('#probs button');
    expect(items).toHaveLength(PROBLEMS.length);
    expect(items[0]!.className).toContain('current');
  });

  it('先手の持ち駒が表示される', () => {
    const sente = document.getElementById('hand-sente')!;
    expect(sente.textContent).toContain('先手持駒');
    expect(sente.querySelectorAll('.hand-piece').length).toBeGreaterThan(0);
  });

  it('ヒントボタンで例外を投げず、メッセージが出る', () => {
    (document.getElementById('hint') as HTMLButtonElement).click();
    expect(document.getElementById('message')?.textContent).toContain('ヒント');
  });

  it('次の問題ボタンでタイトルが変わる', () => {
    (document.getElementById('next') as HTMLButtonElement).click();
    expect(document.getElementById('p-title')?.textContent).toBe(PROBLEMS[1]!.title);
  });
});

function loadFirst(): void {
  (document.querySelector('#probs button') as HTMLButtonElement).click();
}

describe('盤面操作と進捗', () => {
  it('持ち駒を選ぶと打てる升に印が出る', () => {
    loadFirst();
    const board = document.getElementById('board')!;
    expect(board.querySelectorAll('.mark-dest').length).toBe(0);
    (document.querySelector('.hand.sente .hand-piece.selectable') as HTMLElement).click();
    expect(board.querySelectorAll('.mark-dest').length).toBeGreaterThan(0);
  });

  it('待ったボタンは着手前は無効', () => {
    loadFirst();
    expect((document.getElementById('undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('頭金を打って詰ますと正解になり進捗が残る', () => {
    loadFirst(); // 頭金: 後手玉(1筋上段)へ金を打てば一手詰
    (document.querySelector('.hand.sente .hand-piece.selectable') as HTMLElement).click();
    // カーソルは玉の真下(打つ升)にある。Enterで着手する。
    const board = document.getElementById('board')!;
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.getElementById('message')?.textContent).toContain('正解');
    expect(document.getElementById('solved-count')?.textContent).toBe('1');
    expect((document.getElementById('undo') as HTMLButtonElement).disabled).toBe(false);
  });

  it('待ったで一手戻せる', () => {
    // 直前のテストで詰ました状態から戻す。
    (document.getElementById('undo') as HTMLButtonElement).click();
    expect(document.getElementById('message')?.textContent).toContain('戻し');
    expect(document.querySelectorAll('#movelist .mv')).toHaveLength(0);
  });
});
