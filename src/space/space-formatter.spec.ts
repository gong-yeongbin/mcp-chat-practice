import {
  formatBuildingRows,
  formatEventRows,
  formatFloorRows,
  formatSpaceDetail,
  formatSpaceRows,
} from './space-formatter';

describe('space-formatter', () => {
  it('검색 결과를 markdown 표로 만든다', () => {
    const output = formatSpaceRows([
      { id: 'B1-1F-101', name: '그라운드', purpose: '팝업존', capacity: 150, floor: 1, building: '성수 플래그십' },
    ]);

    expect(output).toBe(
      [
        '| id | 이름 | 용도 | 수용인원 | 층 | 건물 |',
        '| --- | --- | --- | --- | --- | --- |',
        '| B1-1F-101 | 그라운드 | 팝업존 | 150 | 1 | 성수 플래그십 |',
        '',
        '1 rows',
      ].join('\n'),
    );
  });

  it('결과가 없으면 안내 문구를 준다', () => {
    expect(formatSpaceRows([])).toBe('결과 없음 (0 rows).');
  });

  it('건물 목록을 표로 만든다', () => {
    const output = formatBuildingRows([
      { name: '성수 플래그십', address: '서울시 성동구 연무장길 30', floors: 4, spaces: 10 },
    ]);

    expect(output).toContain('| 성수 플래그십 | 서울시 성동구 연무장길 30 | 4 | 10 |');
  });

  it('층 목록 위에 건물 이름과 주소를 붙인다', () => {
    const output = formatFloorRows({ id: 'B1', name: '성수 플래그십', address: '서울시 성동구 연무장길 30' }, [
      { floor: 1, name: '1층', spaces: 3, purposes: '팝업존 2, 야외광장 1' },
    ]);

    expect(output.split('\n')[0]).toBe('성수 플래그십 (서울시 성동구 연무장길 30)');
    expect(output).toContain('| 1 | 1층 | 3 | 팝업존 2, 야외광장 1 |');
  });

  it('공간 상세는 표 대신 키:값 블록으로 만든다', () => {
    const output = formatSpaceDetail({
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

    expect(output).toBe(
      [
        'id: B1-1F-101',
        '이름: 그라운드',
        '용도: 팝업존',
        '수용인원: 150명',
        '면적: 330㎡',
        '위치: 성수 플래그십 1층 101호',
        '주소: 서울시 성동구 연무장길 30',
      ].join('\n'),
    );
  });
});

describe('formatEventRows', () => {
  it('행사 이력을 표로 만든다 — 후속 조회용 spaceId를 같이 준다', () => {
    const output = formatEventRows([
      {
        title: '무신사 스탠다드 팝업스토어',
        brand: '무신사',
        type: '팝업',
        period: '2024-03-15 ~ 2024-04-14',
        spaceId: 'B1-1F-101',
        space: '그라운드',
        building: '성수 플래그십',
      },
    ]);

    expect(output).toContain(
      '| 무신사 스탠다드 팝업스토어 | 무신사 | 팝업 | 2024-03-15 ~ 2024-04-14 | 그라운드 | 성수 플래그십 | B1-1F-101 |',
    );
  });
});
