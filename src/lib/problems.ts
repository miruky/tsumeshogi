import { buildPosition } from './shogi';
import type { Problem } from './types';

// 手数は詰みまでの総手数(先手・後手を合わせた奇数)。
// 盤は r=0 が上(玉方=後手)側、c=0 が左。後手玉を上辺で狙う配置にしている。
// すべての問題は problems.test.ts が「ちょうどその手数で詰み、それより短くは詰まない」ことを検証する。

export const PROBLEMS: readonly Problem[] = [
  {
    id: 'm1-atama-kin',
    title: '頭金',
    moves: 1,
    note: '支えのある金を玉の真上に。最も基本的な詰みの形。',
    position: buildPosition(
      [
        [0, 4, 'w', 'K'],
        [2, 3, 'b', 'S'], // 打つ金を支える銀(玉には利かない)
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm1-ryu',
    title: '竜の利き',
    moves: 1,
    note: '竜が逃げ道と打つ金の両方を押さえている。',
    position: buildPosition(
      [
        [0, 4, 'w', 'K'],
        [2, 3, 'b', 'R', true], // 竜
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm3-hisha-kin',
    title: '飛車と金',
    moves: 3,
    note: '飛車で退路を断ち、金一枚で仕留める。',
    position: buildPosition(
      [
        [0, 4, 'w', 'K'],
        [2, 3, 'b', 'R'],
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm3-tan-kaku',
    title: '端の角',
    moves: 3,
    note: '角の利きを背に、金を二枚使って端へ押し込む。',
    position: buildPosition(
      [
        [0, 1, 'w', 'K'],
        [2, 1, 'b', 'B'],
      ],
      { G: 2 },
    ),
  },
  {
    id: 'm5-hisha-gin',
    title: '飛車と銀',
    moves: 5,
    note: '銀の打ち場所を読む。飛車を支えに端へ追う五手。',
    position: buildPosition(
      [
        [0, 1, 'w', 'K'],
        [2, 2, 'b', 'R'],
      ],
      { S: 1 },
    ),
  },
  {
    id: 'm5-keima',
    title: '桂を絡めて',
    moves: 5,
    note: '桂の王手から組み立てる。金と銀の連携で詰ます。',
    position: buildPosition(
      [
        [0, 4, 'w', 'K'],
        [3, 4, 'b', 'N'],
      ],
      { G: 1, S: 1 },
    ),
  },
];
