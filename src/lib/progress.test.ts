import { describe, it, expect } from 'vitest';
import { parseHash, buildHash, serializeProgress, parseProgress } from './progress';

describe('URLハッシュ', () => {
  it('問題IDを符号化して取り出せる', () => {
    const h = buildHash('m3-hisha-kin');
    expect(h).toBe('#p=m3-hisha-kin');
    expect(parseHash(h)).toBe('m3-hisha-kin');
  });

  it('先頭の # が無くても解釈する', () => {
    expect(parseHash('p=m1-ryu')).toBe('m1-ryu');
  });

  it('複数パラメータから p を選ぶ', () => {
    expect(parseHash('#x=1&p=m5-keima&y=2')).toBe('m5-keima');
  });

  it('空や無関係なハッシュは null', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#q=foo')).toBeNull();
  });
});

describe('進捗の保存と復元', () => {
  const known = ['a', 'b', 'c'];

  it('集合を整列して保存し、重複を畳む', () => {
    expect(serializeProgress(['b', 'a', 'a'])).toBe('["a","b"]');
  });

  it('保存値を実在IDだけに絞って復元する', () => {
    const raw = serializeProgress(['c', 'a', 'zzz']);
    expect(parseProgress(raw, known)).toEqual(['a', 'c']);
  });

  it('壊れた値は空配列にフォールバックする', () => {
    expect(parseProgress('{not json', known)).toEqual([]);
    expect(parseProgress('null', known)).toEqual([]);
    expect(parseProgress('{"a":1}', known)).toEqual([]);
    expect(parseProgress(null, known)).toEqual([]);
  });

  it('未知の型を含む配列でも文字列だけ拾う', () => {
    expect(parseProgress('["a",1,true,"b"]', known)).toEqual(['a', 'b']);
  });
});
