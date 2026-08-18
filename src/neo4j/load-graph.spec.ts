import { BRANDS, EVENTS } from '../space/event.data';
import { BUILDINGS, FLOORS, SPACES } from '../space/space.data';
import { chunk, findBrokenReferences } from './load-graph';

describe('chunk', () => {
  it('나누어떨어지면 같은 크기로 쪼갠다', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('마지막 덩어리는 작을 수 있다', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('크기가 항목 수보다 크면 한 덩어리다', () => {
    expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
  });

  it('빈 배열은 덩어리도 없다', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('쪼개도 항목이 유실되거나 중복되지 않는다', () => {
    const items = Array.from({ length: 97 }, (_, i) => i);

    expect(chunk(items, 10).flat()).toEqual(items);
  });

  it('크기가 0 이하면 무한 루프 대신 거부한다', () => {
    expect(() => chunk([1], 0)).toThrow(/1 이상/);
  });
});

describe('findBrokenReferences', () => {
  it('현재 in-memory 데이터는 참조가 온전하다', () => {
    expect(findBrokenReferences()).toEqual([]);
  });

  it('적재 대상 건수가 원본과 일치한다', () => {
    expect({
      buildings: BUILDINGS.length,
      floors: FLOORS.length,
      spaces: SPACES.length,
      brands: BRANDS.length,
      events: EVENTS.length,
    }).toEqual({ buildings: 3, floors: 12, spaces: 28, brands: 12, events: 20 });
  });
});
