/**
 * 브랜드와 행사 이력 가짜 데이터.
 *
 * 공간 데이터(space.data.ts)에는 시간축이 없어서 "과거에 무신사 팝업 한 공간" 같은
 * 질문에 답할 수 없다. 그 질문에 필요한 건 브랜드와, 기간을 가진 행사 이력이다.
 *
 * 날짜는 'YYYY-MM-DD' 문자열이다. 사전순 비교가 곧 시간순 비교라 별도 파싱이 필요 없다.
 */

export const BRAND_CATEGORIES = ['패션', '뷰티', '식음료', 'IT', '리빙', '엔터테인먼트'] as const;

export const EVENT_TYPES = ['팝업', '전시', '쇼케이스'] as const;

export type BrandCategory = (typeof BRAND_CATEGORIES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export interface Brand {
  id: string;
  name: string;
  category: BrandCategory;
}

export interface SpaceEvent {
  id: string;
  spaceId: string;
  brandId: string;
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
}

export const BRANDS: Brand[] = [
  { id: 'BR01', name: '무신사', category: '패션' },
  { id: 'BR02', name: '젠틀몬스터', category: '패션' },
  { id: 'BR03', name: '아더에러', category: '패션' },
  { id: 'BR04', name: '올리브영', category: '뷰티' },
  { id: 'BR05', name: '탬버린즈', category: '뷰티' },
  { id: 'BR06', name: '노티드', category: '식음료' },
  { id: 'BR07', name: '스타벅스', category: '식음료' },
  { id: 'BR08', name: '삼성전자', category: 'IT' },
  { id: 'BR09', name: '카카오', category: 'IT' },
  { id: 'BR10', name: '이케아', category: '리빙' },
  { id: 'BR11', name: '하이브', category: '엔터테인먼트' },
  { id: 'BR12', name: '넷플릭스', category: '엔터테인먼트' },
];

/**
 * 의도적으로 심어둔 검증 포인트:
 *
 *  - 무신사(BR01)는 과거 팝업 2건 + 과거 쇼케이스 1건 + 미래 팝업 1건을 갖는다.
 *    "과거에 무신사 팝업 한 공간"이라는 질문에서 유형 필터(팝업 vs 쇼케이스)와
 *    시점 필터(과거 vs 예정)가 둘 다 실제로 걸러내야만 정답이 나온다.
 *  - 그라운드(B1-1F-101)와 스트리트존(B3-1F-102)은 여러 브랜드가 거쳐갔다.
 *    "이 공간을 쓴 브랜드들" 같은 역방향 질문을 시험할 수 있다.
 *  - 컨벤션홀(B2-2F-201)은 쇼케이스만 열렸다. 유형별 편중을 만들어둔 것이다.
 */
export const EVENTS: SpaceEvent[] = [
  // 무신사 — 예시 질문의 정답 후보
  { id: 'EV01', spaceId: 'B1-1F-101', brandId: 'BR01', title: '무신사 스탠다드 팝업스토어', type: '팝업', startDate: '2024-03-15', endDate: '2024-04-14' },
  { id: 'EV02', spaceId: 'B3-1F-102', brandId: 'BR01', title: '무신사 테라스 팝업', type: '팝업', startDate: '2025-05-01', endDate: '2025-05-31' },
  { id: 'EV03', spaceId: 'B2-2F-201', brandId: 'BR01', title: '무신사 뷰티 쇼케이스', type: '쇼케이스', startDate: '2026-02-10', endDate: '2026-02-14' },
  { id: 'EV04', spaceId: 'B2-3F-301', brandId: 'BR01', title: '무신사 가든 팝업', type: '팝업', startDate: '2026-10-01', endDate: '2026-10-31' },

  // 그 외 과거 행사
  { id: 'EV05', spaceId: 'B1-2F-201', brandId: 'BR02', title: '젠틀몬스터 아이웨어 전시', type: '전시', startDate: '2024-09-01', endDate: '2024-10-31' },
  { id: 'EV06', spaceId: 'B3-1F-102', brandId: 'BR06', title: '노티드 크리스마스 팝업', type: '팝업', startDate: '2024-12-01', endDate: '2024-12-25' },
  { id: 'EV07', spaceId: 'B1-1F-102', brandId: 'BR04', title: '올리브영 뷰티 팝업', type: '팝업', startDate: '2025-03-10', endDate: '2025-04-09' },
  { id: 'EV08', spaceId: 'B1-4F-401', brandId: 'BR07', title: '스타벅스 루프탑 팝업', type: '팝업', startDate: '2025-06-01', endDate: '2025-06-30' },
  { id: 'EV09', spaceId: 'B2-1F-101', brandId: 'BR05', title: '탬버린즈 향수 전시', type: '전시', startDate: '2025-08-01', endDate: '2025-09-30' },
  { id: 'EV10', spaceId: 'B3-2F-201', brandId: 'BR11', title: '하이브 신인 쇼케이스', type: '쇼케이스', startDate: '2025-10-05', endDate: '2025-10-07' },
  { id: 'EV11', spaceId: 'B3-2F-202', brandId: 'BR03', title: '아더에러 컬렉션 팝업', type: '팝업', startDate: '2025-11-01', endDate: '2025-11-30' },
  { id: 'EV12', spaceId: 'B2-2F-201', brandId: 'BR08', title: '삼성전자 신제품 쇼케이스', type: '쇼케이스', startDate: '2026-01-15', endDate: '2026-01-20' },
  { id: 'EV13', spaceId: 'B1-2F-201', brandId: 'BR10', title: '이케아 홈퍼니싱 전시', type: '전시', startDate: '2026-03-01', endDate: '2026-03-31' },
  { id: 'EV14', spaceId: 'B3-2F-203', brandId: 'BR09', title: '카카오프렌즈 팝업', type: '팝업', startDate: '2026-04-01', endDate: '2026-04-30' },
  { id: 'EV15', spaceId: 'B3-3F-301', brandId: 'BR12', title: '넷플릭스 오리지널 전시', type: '전시', startDate: '2026-05-01', endDate: '2026-06-30' },
  { id: 'EV16', spaceId: 'B1-1F-103', brandId: 'BR06', title: '노티드 여름 팝업', type: '팝업', startDate: '2026-07-01', endDate: '2026-07-20' },

  // 진행 중 (오늘 기준)
  { id: 'EV17', spaceId: 'B1-1F-101', brandId: 'BR02', title: '젠틀몬스터 서머 팝업', type: '팝업', startDate: '2026-08-01', endDate: '2026-08-31' },
  { id: 'EV18', spaceId: 'B3-1F-102', brandId: 'BR04', title: '올리브영 선케어 팝업', type: '팝업', startDate: '2026-08-10', endDate: '2026-09-10' },

  // 예정
  { id: 'EV19', spaceId: 'B2-1F-103', brandId: 'BR05', title: '탬버린즈 신제품 팝업', type: '팝업', startDate: '2026-09-15', endDate: '2026-10-15' },
  { id: 'EV20', spaceId: 'B3-1F-101', brandId: 'BR11', title: '하이브 팬미팅 쇼케이스', type: '쇼케이스', startDate: '2026-11-20', endDate: '2026-11-22' },
];
