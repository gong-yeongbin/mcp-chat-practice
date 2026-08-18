import { SpaceService } from './space.service';

describe('SpaceService', () => {
  const service = new SpaceService();

  describe('searchSpaces', () => {
    it('용도와 최소 수용인원을 함께 걸러낸다', () => {
      const rows = service.searchSpaces({ purpose: '팝업존', minCapacity: 100, limit: 20 });

      expect(rows.map((r) => r.name)).toEqual(['그라운드', '스트리트존']);
      expect(rows.every((r) => r.purpose === '팝업존' && r.capacity >= 100)).toBe(true);
    });

    it('가장 작은 공간에서 minCapacity 경계가 갈린다', () => {
      const included = service.searchSpaces({ purpose: '스튜디오', minCapacity: 15, limit: 20 });
      const excluded = service.searchSpaces({ purpose: '스튜디오', minCapacity: 16, limit: 20 });

      expect(included.map((r) => r.name)).toContain('크리에이터룸');
      expect(excluded.map((r) => r.name)).not.toContain('크리에이터룸');
    });

    it('건물이 달라도 이름이 같은 공간을 모두 찾는다', () => {
      const rows = service.searchSpaces({ keyword: '메인홀', limit: 20 });

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.id).sort()).toEqual(['B1-2F-201', 'B3-1F-101']);
      expect(rows.map((r) => r.building).sort()).toEqual(['성수 플래그십', '홍대 컬처몰']);
    });

    it('건물 이름으로 범위를 좁힌다', () => {
      const rows = service.searchSpaces({ keyword: '메인홀', buildingName: '홍대', limit: 20 });

      expect(rows.map((r) => r.id)).toEqual(['B3-1F-101']);
    });

    it('공간 번호로도 검색된다', () => {
      expect(service.searchSpaces({ keyword: '501', limit: 20 }).map((r) => r.id)).toEqual(['B3-5F-501']);
    });

    it('limit으로 결과 수를 자른다', () => {
      expect(service.searchSpaces({ limit: 3 })).toHaveLength(3);
    });

    it('건물·층·호수 순으로 정렬한다', () => {
      const order = service.searchSpaces({ buildingName: '성수', limit: 50 }).map((r) => r.id);

      expect(order).toEqual([...order].sort());
    });

    it('조건에 맞는 게 없으면 빈 배열을 준다', () => {
      expect(service.searchSpaces({ keyword: '존재하지않는공간', limit: 20 })).toEqual([]);
    });
  });

  describe('getSpace', () => {
    it('층과 건물 정보를 합쳐서 준다', () => {
      expect(service.getSpace('B1-1F-101')).toEqual({
        id: 'B1-1F-101',
        name: '그라운드',
        number: '101',
        purpose: '팝업존',
        capacity: 150,
        areaSqm: 330,
        floor: 1,
        floorName: '1층',
        building: '성수 플래그십',
        address: '서울시 성동구 연무장길 30',
      });
    });

    it('없는 id면 예외 대신 null을 준다', () => {
      expect(service.getSpace('없는id')).toBeNull();
    });
  });

  describe('listBuildings', () => {
    it('건물별 층 수와 공간 수를 센다', () => {
      const rows = service.listBuildings();

      expect(rows.map((r) => r.name)).toEqual(['성수 플래그십', '가로수길 아트센터', '홍대 컬처몰']);
      expect(rows.map((r) => r.floors)).toEqual([4, 3, 5]);
      expect(rows.map((r) => r.spaces)).toEqual([10, 7, 11]);
    });

    it('건물별 공간 수의 합이 전체 공간 수와 같다', () => {
      const total = service.listBuildings().reduce((sum, r) => sum + r.spaces, 0);

      expect(total).toBe(service.searchSpaces({ limit: 1000 }).length);
    });
  });

  describe('getBuildingFloors', () => {
    it('층별 공간 수와 용도 분포를 준다', () => {
      const result = service.getBuildingFloors('성수');

      expect(result?.building.name).toBe('성수 플래그십');
      expect(result?.rows.map((r) => r.floor)).toEqual([1, 2, 3, 4]);
      expect(result?.rows.find((r) => r.floor === 1)).toMatchObject({
        spaces: 3,
        purposes: '팝업존 2, 야외광장 1',
      });
    });

    it('층별 공간 수의 합이 그 건물의 공간 수와 같다', () => {
      const result = service.getBuildingFloors('홍대');
      const summed = result!.rows.reduce((sum, r) => sum + r.spaces, 0);

      expect(summed).toBe(service.listBuildings().find((b) => b.name === '홍대 컬처몰')!.spaces);
    });

    it('없는 건물이면 null을 준다', () => {
      expect(service.getBuildingFloors('없는건물')).toBeNull();
    });
  });
});
