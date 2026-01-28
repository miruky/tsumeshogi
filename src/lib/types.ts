// 将棋の最小表現。描画から独立させ、ロジックだけで詰みを判定・探索できるようにする。

/** 手番・駒の所属。b=先手(攻め方)、w=後手(玉方)。 */
export type Side = 'b' | 'w';

/** 駒の素の種類。K=玉 R=飛 B=角 G=金 S=銀 N=桂 L=香 P=歩。 */
export type Base = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';

export interface Piece {
  base: Base;
  side: Side;
  /** 成りの有無。金・玉は常にfalse。 */
  promoted: boolean;
}

/** 盤上の位置。r=段(0が上=後手側)、c=筋(0が左)。 */
export interface Sq {
  r: number;
  c: number;
}

/** 持ち駒の枚数。玉は持ち駒にならない。 */
export type Hand = Record<Exclude<Base, 'K'>, number>;

/** 一手。盤上の移動か、持ち駒を打つか。 */
export interface Move {
  to: Sq;
  /** 移動元。打つ手では未指定。 */
  from?: Sq;
  /** 打つ駒の種類。打つ手のときだけ指定。 */
  drop?: Exclude<Base, 'K'>;
  /** 成るかどうか。 */
  promote?: boolean;
}

/** 1局面: 盤・両者の持ち駒・手番。 */
export interface Position {
  /** 81マス。idx = r*9 + c。 */
  board: (Piece | null)[];
  hands: { b: Hand; w: Hand };
  turn: Side;
}

/** 詰将棋の問題。 */
export interface Problem {
  id: string;
  title: string;
  /** 手数(奇数。攻め方の着手数)。 */
  moves: number;
  position: Position;
  /** 解説(任意)。 */
  note?: string;
}
