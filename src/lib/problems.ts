import { buildPosition } from './shogi';
import type { Problem } from './types';

// 手数は詰みまでの総手数(先手・後手を合わせた奇数)。
// 盤は r=0 が上(玉方=後手)側、c=0 が左。後手玉を上辺で狙う配置にしている。
// すべての問題は problems.test.ts が「ちょうどその手数で詰み、それより短くは詰まない」ことを検証する。
// 難易度の昇順に並べ、1手の基本形から7手の追い詰めまで段階的に学べるようにした。

export const PROBLEMS: readonly Problem[] = [
  {
    id: 'm1-atama-kin',
    title: '頭金',
    moves: 1,
    note: '支えのある金を玉の真上に置く、最も基本的な詰みの形。',
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
    id: 'm1-sumi-kin',
    title: '隅の支え金',
    moves: 1,
    note: '隅に追われた玉へ、銀に支えられた金を打ち込む。',
    position: buildPosition(
      [
        [0, 0, 'w', 'K'],
        [2, 1, 'b', 'S'], // 打つ金を斜め下から支える銀
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm3-hisha-kin',
    title: '飛車と金',
    moves: 3,
    note: '飛車で退路を断ち、金一枚で仕留める。まず王手で寄せる手を読む。',
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
    id: 'm3-sahen-kin',
    title: '左辺へ追う',
    moves: 3,
    note: '飛車の縦利きを軸に、金で逃げ場を一つずつ消す。',
    position: buildPosition(
      [
        [0, 2, 'w', 'K'],
        [2, 1, 'b', 'R'],
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm3-uhen-kin',
    title: '右辺へ追う',
    moves: 3,
    note: '左右の感覚を反転させて読む。飛車と金で右の端へ寄せる。',
    position: buildPosition(
      [
        [0, 6, 'w', 'K'],
        [2, 7, 'b', 'R'],
      ],
      { G: 1 },
    ),
  },
  {
    id: 'm3-kaku-nimai',
    title: '角と二枚金',
    moves: 3,
    note: '角を遠くに置き、金二枚の連携だけで中段の玉を詰ます。',
    position: buildPosition(
      [
        [0, 3, 'w', 'K'],
        [2, 3, 'b', 'B'],
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
  {
    id: 'm5-hashi-hi-gin',
    title: '端の飛と銀',
    moves: 5,
    note: '右端へ寄った玉を、飛車の横利きと銀で仕留める。',
    position: buildPosition(
      [
        [0, 7, 'w', 'K'],
        [2, 6, 'b', 'R'],
      ],
      { S: 1 },
    ),
  },
  {
    id: 'm5-keima-kingin',
    title: '桂と金銀',
    moves: 5,
    note: '桂の王手を起点に、金銀を順に使って逃げ場を塞ぐ。',
    position: buildPosition(
      [
        [0, 2, 'w', 'K'],
        [3, 2, 'b', 'N'],
      ],
      { G: 1, S: 1 },
    ),
  },
  {
    id: 'm7-ryu-gin',
    title: '竜と銀の追い',
    moves: 7,
    note: '竜で広く押さえ、銀の連続王手で端まで追い込む。長手数の総仕上げ。',
    position: buildPosition(
      [
        [0, 1, 'w', 'K'],
        [3, 2, 'b', 'R', true], // 竜
      ],
      { S: 1 },
    ),
  },
  {
    id: 'm7-ryu-gin-migi',
    title: '竜と銀の追い(右)',
    moves: 7,
    note: '左右を入れ替えた七手詰。右の端へ向かう追い方を、もう一度自力で組み立てる。',
    position: buildPosition(
      [
        [0, 7, 'w', 'K'],
        [3, 6, 'b', 'R', true], // 竜
      ],
      { S: 1 },
    ),
  },
];
