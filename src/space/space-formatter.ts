import { formatRows } from '../cypher/result-formatter';
import { EventRow } from './event.service';
import { Building } from './space.data';
import { BuildingRow, FloorRow, SpaceDetail, SpaceRow } from './space.service';

export function formatSpaceRows(rows: SpaceRow[]): string {
  return formatRows(
    ['id', '이름', '용도', '수용인원', '층', '건물'],
    rows.map((r) => [r.id, r.name, r.purpose, r.capacity, r.floor, r.building]),
  );
}

export function formatEventRows(rows: EventRow[]): string {
  return formatRows(
    ['행사', '브랜드', '유형', '기간', '공간', '건물', 'spaceId'],
    rows.map((r) => [r.title, r.brand, r.type, r.period, r.space, r.building, r.spaceId]),
  );
}

export function formatBuildingRows(rows: BuildingRow[]): string {
  return formatRows(
    ['건물', '주소', '층 수', '공간 수'],
    rows.map((r) => [r.name, r.address, r.floors, r.spaces]),
  );
}

export function formatFloorRows(building: Building, rows: FloorRow[]): string {
  const table = formatRows(
    ['층', '이름', '공간 수', '용도 분포'],
    rows.map((r) => [r.floor, r.name, r.spaces, r.purposes]),
  );

  return `${building.name} (${building.address})\n\n${table}`;
}

/**
 * 한 건짜리 상세는 표보다 키:값 블록이 읽기 쉽다.
 * 열 하나짜리 표를 만들면 모델이 값과 헤더를 헷갈린다.
 */
export function formatSpaceDetail(detail: SpaceDetail): string {
  return [
    `id: ${detail.id}`,
    `이름: ${detail.name}`,
    `용도: ${detail.purpose}`,
    `수용인원: ${detail.capacity}명`,
    `면적: ${detail.areaSqm}㎡`,
    `위치: ${detail.building} ${detail.floorName} ${detail.number}호`,
    `주소: ${detail.address}`,
  ].join('\n');
}
