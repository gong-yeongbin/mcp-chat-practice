import { Injectable } from '@nestjs/common';

import { BRANDS, BrandCategory, EVENTS, EventType, SpaceEvent } from './event.data';
import { SpaceService } from './space.service';

/** 시점 필터. "과거에 무신사 팝업 한 공간" 같은 질문의 '과거에'를 받는다. */
export const EVENT_PERIODS = ['과거', '진행중', '예정'] as const;

export type EventPeriod = (typeof EVENT_PERIODS)[number];

export interface EventRow {
  title: string;
  brand: string;
  type: EventType;
  period: string;
  spaceId: string;
  space: string;
  building: string;
}

export interface SearchEventsInput {
  brandName?: string;
  brandCategory?: BrandCategory;
  type?: EventType;
  period?: EventPeriod;
  spaceId?: string;
  buildingName?: string;
  limit: number;
}

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class EventService {
  private readonly brandsById = new Map(BRANDS.map((b) => [b.id, b]));

  constructor(private readonly spaces: SpaceService) {}

  /**
   * 조건에 맞는 행사를 최근 시작순으로 돌려준다.
   *
   * `now`는 시점 필터의 기준일이다. 기본은 오늘이고, 테스트에서만 고정 날짜를 넘긴다.
   * 날짜가 'YYYY-MM-DD' 문자열이라 사전순 비교가 곧 시간순 비교다.
   */
  searchEvents(input: SearchEventsInput, now: string = today()): EventRow[] {
    const { brandName, brandCategory, type, period, spaceId, buildingName, limit } = input;

    const matched = EVENTS.filter((event) => {
      const brand = this.brandsById.get(event.brandId);
      if (!brand) return false;

      if (brandName && !includesIgnoreCase(brand.name, brandName)) return false;
      if (brandCategory && brand.category !== brandCategory) return false;
      if (type && event.type !== type) return false;
      if (spaceId && event.spaceId !== spaceId) return false;
      if (period && !this.matchesPeriod(event, period, now)) return false;
      if (buildingName) {
        const space = this.spaces.getSpace(event.spaceId);
        if (!space || !includesIgnoreCase(space.building, buildingName)) return false;
      }
      return true;
    });

    return matched
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, limit)
      .map((event) => this.toRow(event));
  }

  private matchesPeriod(event: SpaceEvent, period: EventPeriod, now: string): boolean {
    if (period === '과거') return event.endDate < now;
    if (period === '예정') return event.startDate > now;
    return event.startDate <= now && now <= event.endDate;
  }

  private toRow(event: SpaceEvent): EventRow {
    const space = this.spaces.getSpace(event.spaceId);
    if (!space) throw new Error(`행사 ${event.id}의 공간 ${event.spaceId}이 존재하지 않는다.`);

    return {
      title: event.title,
      brand: this.brandsById.get(event.brandId)!.name,
      type: event.type,
      period: `${event.startDate} ~ ${event.endDate}`,
      spaceId: space.id,
      space: space.name,
      building: space.building,
    };
  }
}
