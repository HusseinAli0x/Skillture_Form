import { describe, expect, it } from 'vitest';
import { moveItem, renumber } from './listOps';

describe('moveItem', () => {
  it('moves forward and backward without mutating', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clamps the target and ignores a bad source', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 1, -4)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('renumber', () => {
  it('lists only items whose order changed', () => {
    const ordered = [
      { id: 'x', sort_order: 0 },
      { id: 'y', sort_order: 2 },
      { id: 'z', sort_order: 1 },
    ];
    expect(renumber(ordered)).toEqual([
      { id: 'y', sort_order: 1 },
      { id: 'z', sort_order: 2 },
    ]);
  });

  it('breaks ties among equal orders', () => {
    const ordered = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 0 },
      { id: 'c', sort_order: 0 },
    ];
    expect(renumber(ordered)).toEqual([
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]);
  });
});
