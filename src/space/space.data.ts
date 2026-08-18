/**
 * 팝업·행사 대관 공간 가짜 데이터.
 *
 * 아직 DB를 붙이지 않는다. tool을 몇 개로 쪼갤지, description을 어떻게 써야 모델이
 * 올바른 tool을 고르는지를 먼저 검증하기 위해 데이터를 코드 안에 둔다.
 * 나중에 MSSQL/Neo4j로 바꿀 때는 SpaceService 내부만 고치면 된다.
 *
 * 브랜드와 행사 이력은 event.data.ts에 있다.
 */

export const SPACE_PURPOSES = ['팝업존', '전시장', '아트리움', '야외광장', '스튜디오', '멀티홀'] as const;

export type SpacePurpose = (typeof SPACE_PURPOSES)[number];

export interface Building {
  id: string;
  name: string;
  address: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  level: number;
  name: string;
}

export interface Space {
  id: string;
  floorId: string;
  name: string;
  number: string;
  purpose: SpacePurpose;
  capacity: number;
  areaSqm: number;
}

export const BUILDINGS: Building[] = [
  { id: 'B1', name: '성수 플래그십', address: '서울시 성동구 연무장길 30' },
  { id: 'B2', name: '가로수길 아트센터', address: '서울시 강남구 도산대로 45' },
  { id: 'B3', name: '홍대 컬처몰', address: '서울시 마포구 양화로 120' },
];

export const FLOORS: Floor[] = [
  { id: 'B1-1F', buildingId: 'B1', level: 1, name: '1층' },
  { id: 'B1-2F', buildingId: 'B1', level: 2, name: '2층' },
  { id: 'B1-3F', buildingId: 'B1', level: 3, name: '3층' },
  { id: 'B1-4F', buildingId: 'B1', level: 4, name: '4층' },
  { id: 'B2-1F', buildingId: 'B2', level: 1, name: '1층' },
  { id: 'B2-2F', buildingId: 'B2', level: 2, name: '2층' },
  { id: 'B2-3F', buildingId: 'B2', level: 3, name: '3층' },
  { id: 'B3-1F', buildingId: 'B3', level: 1, name: '1층' },
  { id: 'B3-2F', buildingId: 'B3', level: 2, name: '2층' },
  { id: 'B3-3F', buildingId: 'B3', level: 3, name: '3층' },
  { id: 'B3-4F', buildingId: 'B3', level: 4, name: '4층' },
  { id: 'B3-5F', buildingId: 'B3', level: 5, name: '5층' },
];

/**
 * capacity를 15~400으로 넓게 벌려뒀다. minCapacity 필터가 실제로 갈리는지 보기 위해서다.
 *
 * "메인홀"은 성수 플래그십과 홍대 컬처몰에 각각 있다. 모델이 건물 없이 이름만으로
 * 지목했을 때 tool이 어떻게 반응해야 하는지가 실제로 부딪히는 문제라 데이터에 심어뒀다.
 */
export const SPACES: Space[] = [
  // 성수 플래그십 (B1)
  { id: 'B1-1F-101', floorId: 'B1-1F', name: '그라운드', number: '101', purpose: '팝업존', capacity: 150, areaSqm: 330 },
  { id: 'B1-1F-102', floorId: 'B1-1F', name: '사이드윙', number: '102', purpose: '팝업존', capacity: 60, areaSqm: 120 },
  { id: 'B1-1F-103', floorId: 'B1-1F', name: '야외데크', number: '103', purpose: '야외광장', capacity: 200, areaSqm: 400 },
  { id: 'B1-2F-201', floorId: 'B1-2F', name: '메인홀', number: '201', purpose: '전시장', capacity: 300, areaSqm: 600 },
  { id: 'B1-2F-202', floorId: 'B1-2F', name: '갤러리A', number: '202', purpose: '전시장', capacity: 80, areaSqm: 180 },
  { id: 'B1-2F-203', floorId: 'B1-2F', name: '갤러리B', number: '203', purpose: '전시장', capacity: 80, areaSqm: 180 },
  { id: 'B1-3F-301', floorId: 'B1-3F', name: '스튜디오1', number: '301', purpose: '스튜디오', capacity: 30, areaSqm: 90 },
  { id: 'B1-3F-302', floorId: 'B1-3F', name: '스튜디오2', number: '302', purpose: '스튜디오', capacity: 30, areaSqm: 90 },
  { id: 'B1-4F-401', floorId: 'B1-4F', name: '루프탑', number: '401', purpose: '야외광장', capacity: 120, areaSqm: 350 },
  { id: 'B1-4F-402', floorId: 'B1-4F', name: '라운지홀', number: '402', purpose: '멀티홀', capacity: 100, areaSqm: 220 },

  // 가로수길 아트센터 (B2)
  { id: 'B2-1F-101', floorId: 'B2-1F', name: '아트리움', number: '101', purpose: '아트리움', capacity: 250, areaSqm: 500 },
  { id: 'B2-1F-102', floorId: 'B2-1F', name: '윈도우갤러리', number: '102', purpose: '전시장', capacity: 40, areaSqm: 80 },
  { id: 'B2-1F-103', floorId: 'B2-1F', name: '로비팝업', number: '103', purpose: '팝업존', capacity: 40, areaSqm: 90 },
  { id: 'B2-2F-201', floorId: 'B2-2F', name: '컨벤션홀', number: '201', purpose: '멀티홀', capacity: 400, areaSqm: 800 },
  { id: 'B2-2F-202', floorId: 'B2-2F', name: '프리뷰룸', number: '202', purpose: '스튜디오', capacity: 20, areaSqm: 60 },
  { id: 'B2-3F-301', floorId: 'B2-3F', name: '테라스가든', number: '301', purpose: '야외광장', capacity: 150, areaSqm: 300 },
  { id: 'B2-3F-302', floorId: 'B2-3F', name: '소전시실', number: '302', purpose: '전시장', capacity: 60, areaSqm: 140 },

  // 홍대 컬처몰 (B3)
  { id: 'B3-1F-101', floorId: 'B3-1F', name: '메인홀', number: '101', purpose: '멀티홀', capacity: 350, areaSqm: 700 },
  { id: 'B3-1F-102', floorId: 'B3-1F', name: '스트리트존', number: '102', purpose: '팝업존', capacity: 100, areaSqm: 200 },
  { id: 'B3-1F-103', floorId: 'B3-1F', name: '오픈스퀘어', number: '103', purpose: '야외광장', capacity: 220, areaSqm: 450 },
  { id: 'B3-2F-201', floorId: 'B3-2F', name: '컬처스테이지', number: '201', purpose: '멀티홀', capacity: 200, areaSqm: 450 },
  { id: 'B3-2F-202', floorId: 'B3-2F', name: '팝업박스A', number: '202', purpose: '팝업존', capacity: 50, areaSqm: 110 },
  { id: 'B3-2F-203', floorId: 'B3-2F', name: '팝업박스B', number: '203', purpose: '팝업존', capacity: 50, areaSqm: 110 },
  { id: 'B3-3F-301', floorId: 'B3-3F', name: '미디어아트홀', number: '301', purpose: '전시장', capacity: 120, areaSqm: 280 },
  { id: 'B3-3F-302', floorId: 'B3-3F', name: '서브갤러리', number: '302', purpose: '전시장', capacity: 45, areaSqm: 100 },
  { id: 'B3-4F-401', floorId: 'B3-4F', name: '사운드스튜디오', number: '401', purpose: '스튜디오', capacity: 25, areaSqm: 70 },
  { id: 'B3-4F-402', floorId: 'B3-4F', name: '크리에이터룸', number: '402', purpose: '스튜디오', capacity: 15, areaSqm: 45 },
  { id: 'B3-5F-501', floorId: 'B3-5F', name: '스카이플라자', number: '501', purpose: '야외광장', capacity: 180, areaSqm: 380 },
];
