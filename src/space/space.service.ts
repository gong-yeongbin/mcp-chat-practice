import { Injectable } from '@nestjs/common';

import { Building, BUILDINGS, Floor, FLOORS, Space, SpacePurpose, SPACES } from './space.data';

/** 검색 결과 한 행. 표에 그대로 얹을 수 있는 평평한 모양으로 맞춘다. */
export interface SpaceRow {
  id: string;
  name: string;
  purpose: SpacePurpose;
  capacity: number;
  floor: number;
  building: string;
}

export interface SpaceDetail extends SpaceRow {
  number: string;
  areaSqm: number;
  floorName: string;
  address: string;
}

export interface BuildingRow {
  name: string;
  address: string;
  floors: number;
  spaces: number;
}

export interface FloorRow {
  floor: number;
  name: string;
  spaces: number;
  purposes: string;
}

export interface SearchSpacesInput {
  keyword?: string;
  buildingName?: string;
  purpose?: SpacePurpose;
  minCapacity?: number;
  limit: number;
}

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

@Injectable()
export class SpaceService {
  private readonly floorsById = new Map(FLOORS.map((f) => [f.id, f]));
  private readonly buildingsById = new Map(BUILDINGS.map((b) => [b.id, b]));

  /** 조건에 맞는 공간을 찾는다. 조건이 하나도 없으면 전체에서 limit만큼 잘라 준다. */
  searchSpaces(input: SearchSpacesInput): SpaceRow[] {
    const { keyword, buildingName, purpose, minCapacity, limit } = input;

    const matched = SPACES.filter((space) => {
      if (keyword && !includesIgnoreCase(space.name, keyword) && !includesIgnoreCase(space.number, keyword)) {
        return false;
      }
      if (buildingName && !includesIgnoreCase(this.locate(space).building.name, buildingName)) return false;
      if (purpose && space.purpose !== purpose) return false;
      if (minCapacity !== undefined && space.capacity < minCapacity) return false;
      return true;
    });

    return this.sortByLocation(matched).slice(0, limit).map((space) => this.toRow(space));
  }

  /** 공간 상세. 없는 id면 null — 에러 문구는 tool 계층이 만든다. */
  getSpace(spaceId: string): SpaceDetail | null {
    const space = SPACES.find((s) => s.id === spaceId);
    if (!space) return null;

    const { floor, building } = this.locate(space);
    return {
      ...this.toRow(space),
      number: space.number,
      areaSqm: space.areaSqm,
      floorName: floor.name,
      address: building.address,
    };
  }

  listBuildings(): BuildingRow[] {
    return BUILDINGS.map((building) => {
      const floors = FLOORS.filter((f) => f.buildingId === building.id);
      const floorIds = new Set(floors.map((f) => f.id));

      return {
        name: building.name,
        address: building.address,
        floors: floors.length,
        spaces: SPACES.filter((s) => floorIds.has(s.floorId)).length,
      };
    });
  }

  /** 건물 하나의 층별 구성. 이름이 안 맞으면 null. */
  getBuildingFloors(buildingName: string): { building: Building; rows: FloorRow[] } | null {
    const building = BUILDINGS.find((b) => includesIgnoreCase(b.name, buildingName));
    if (!building) return null;

    const rows = FLOORS.filter((f) => f.buildingId === building.id)
      .sort((a, b) => a.level - b.level)
      .map((floor) => {
        const spaces = SPACES.filter((s) => s.floorId === floor.id);
        const counted = new Map<SpacePurpose, number>();
        for (const space of spaces) {
          counted.set(space.purpose, (counted.get(space.purpose) ?? 0) + 1);
        }

        return {
          floor: floor.level,
          name: floor.name,
          spaces: spaces.length,
          purposes: [...counted].map(([purpose, count]) => `${purpose} ${count}`).join(', '),
        };
      });

    return { building, rows };
  }

  private locate(space: Space): { floor: Floor; building: Building } {
    const floor = this.floorsById.get(space.floorId);
    if (!floor) throw new Error(`공간 ${space.id}의 층 ${space.floorId}이 존재하지 않는다.`);

    const building = this.buildingsById.get(floor.buildingId);
    if (!building) throw new Error(`층 ${floor.id}의 건물 ${floor.buildingId}이 존재하지 않는다.`);

    return { floor, building };
  }

  private toRow(space: Space): SpaceRow {
    const { floor, building } = this.locate(space);
    return {
      id: space.id,
      name: space.name,
      purpose: space.purpose,
      capacity: space.capacity,
      floor: floor.level,
      building: building.name,
    };
  }

  private sortByLocation(spaces: Space[]): Space[] {
    return [...spaces].sort((a, b) => {
      const left = this.locate(a);
      const right = this.locate(b);

      return (
        left.building.name.localeCompare(right.building.name) ||
        left.floor.level - right.floor.level ||
        a.number.localeCompare(b.number)
      );
    });
  }
}
