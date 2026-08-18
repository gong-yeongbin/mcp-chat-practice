import { EventService } from './event.service';
import { SpaceService } from './space.service';

/** 데이터에 미래 행사가 섞여 있으므로 기준일을 고정해야 테스트가 시간에 흔들리지 않는다. */
const NOW = '2026-08-18';

describe('EventService', () => {
  const service = new EventService(new SpaceService());
  const search = (input: Parameters<EventService['searchEvents']>[0]) => service.searchEvents(input, NOW);

  describe('예시 질문: "과거에 무신사 팝업 한 공간 알려줘"', () => {
    it('유형과 시점을 둘 다 걸러야 정답 2건이 나온다', () => {
      const rows = search({ brandName: '무신사', type: '팝업', period: '과거', limit: 20 });

      expect(rows.map((r) => r.space)).toEqual(['스트리트존', '그라운드']);
      expect(rows.map((r) => r.building)).toEqual(['홍대 컬처몰', '성수 플래그십']);
    });

    it('시점을 안 거르면 아직 열리지 않은 팝업까지 섞인다', () => {
      const rows = search({ brandName: '무신사', type: '팝업', limit: 20 });

      expect(rows.map((r) => r.space)).toContain('테라스가든');
    });

    it('유형을 안 거르면 쇼케이스까지 섞인다', () => {
      const rows = search({ brandName: '무신사', period: '과거', limit: 20 });

      expect(rows.map((r) => r.type)).toContain('쇼케이스');
    });
  });

  describe('시점 필터', () => {
    it('진행중은 기준일이 기간 안에 든 행사만 준다', () => {
      const rows = search({ period: '진행중', limit: 20 });

      expect(rows.map((r) => r.brand).sort()).toEqual(['올리브영', '젠틀몬스터']);
    });

    it('예정은 기준일 이후에 시작하는 행사만 준다', () => {
      const rows = search({ period: '예정', limit: 20 });

      expect(rows.every((r) => r.period.slice(0, 10) > NOW)).toBe(true);
      expect(rows.map((r) => r.brand)).toContain('무신사');
    });

    it('과거·진행중·예정을 합치면 전체와 같다', () => {
      const total = (['과거', '진행중', '예정'] as const)
        .map((period) => search({ period, limit: 100 }).length)
        .reduce((sum, n) => sum + n, 0);

      expect(total).toBe(search({ limit: 100 }).length);
    });
  });

  describe('역방향 조회', () => {
    it('공간을 거쳐간 브랜드를 찾는다', () => {
      const rows = search({ spaceId: 'B1-1F-101', limit: 20 });

      expect(rows.map((r) => r.brand)).toEqual(['젠틀몬스터', '무신사']);
    });

    it('건물로 범위를 좁힌다', () => {
      const rows = search({ buildingName: '가로수길', limit: 20 });

      expect(rows.every((r) => r.building === '가로수길 아트센터')).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('브랜드 카테고리로 모아본다', () => {
      const rows = search({ brandCategory: '뷰티', limit: 20 });

      expect(rows.map((r) => r.brand).every((b) => ['올리브영', '탬버린즈'].includes(b))).toBe(true);
    });
  });

  it('최근 시작순으로 정렬한다', () => {
    const starts = search({ limit: 100 }).map((r) => r.period.slice(0, 10));

    expect(starts).toEqual([...starts].sort().reverse());
  });

  it('limit으로 결과 수를 자른다', () => {
    expect(search({ limit: 3 })).toHaveLength(3);
  });

  it('조건에 맞는 게 없으면 빈 배열을 준다', () => {
    expect(search({ brandName: '없는브랜드', limit: 20 })).toEqual([]);
  });
});
