import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { BRAND_CATEGORIES, EVENT_TYPES } from '../../space/event.data';
import { EVENT_PERIODS, EventService } from '../../space/event.service';
import {
  formatBuildingRows,
  formatEventRows,
  formatFloorRows,
  formatSpaceDetail,
  formatSpaceRows,
} from '../../space/space-formatter';
import { SPACE_PURPOSES } from '../../space/space.data';
import { SpaceService } from '../../space/space.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** 에러는 throw하지 않고 결과로 돌려준다. 모델이 메시지를 읽고 스스로 고쳐 재시도하게 하기 위함이다. */
function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

@Injectable()
export class SpaceToolsRegistrar {
  constructor(
    private readonly spaces: SpaceService,
    private readonly events: EventService,
  ) {}

  register(server: McpServer): void {
    this.registerSearchSpaces(server);
    this.registerGetSpace(server);
    this.registerGetBuildingStructure(server);
    this.registerSearchEvents(server);
  }

  private registerSearchSpaces(server: McpServer): void {
    server.registerTool(
      'search_spaces',
      {
        title: '공간 검색',
        description: [
          '조건에 맞는 공간을 찾아 목록으로 돌려준다. 공간 id를 모를 때 가장 먼저 부르는 tool이다.',
          '',
          '언제 쓰나: 사용자가 조건으로 공간을 찾을 때. "100명 들어가는 팝업존", "홍대에 있는 야외광장", "메인홀이 어디야" 같은 질문이 전부 여기에 해당한다.',
          '언제 쓰지 않나: 특정 공간 하나의 상세 정보만 필요하고 이미 id를 알고 있다면 get_space를 쓴다. 건물 전체 구성이 궁금하면 get_building_structure를 쓴다.',
          '',
          '인자 (전부 선택이고, 주는 조건은 AND로 묶인다):',
          '  keyword — 공간 이름 또는 호수의 일부. "갤러리", "101" 처럼 부분 일치로 찾는다.',
          `  buildingName — 건물 이름의 일부. 예: "성수", "홍대"`,
          `  purpose — 용도. ${SPACE_PURPOSES.join(' / ')} 중 하나만 쓸 수 있다.`,
          '  minCapacity — 최소 수용 인원. 이 값 이상인 공간만 남는다.',
          `  limit — 최대 결과 수 (기본 ${DEFAULT_LIMIT}, 최대 ${MAX_LIMIT})`,
          '',
          '예시:',
          '  { "purpose": "팝업존", "minCapacity": 100 }',
          '  { "keyword": "갤러리", "buildingName": "성수" }',
          '',
          '반환 형태: id / 이름 / 용도 / 수용인원 / 층 / 건물 열을 가진 markdown 표.',
          '',
          '주의: 이름이 같은 공간이 건물마다 따로 있을 수 있다. 예를 들어 "메인홀"은 성수 플래그십과 홍대 컬처몰에 모두 있다.',
          '결과가 여러 건이고 사용자가 건물을 지정하지 않았다면, 임의로 하나를 고르지 말고 어느 건물의 공간인지 사용자에게 되물어라.',
        ].join('\n'),
        annotations: { readOnlyHint: true },
        inputSchema: {
          keyword: z.string().optional().describe('공간 이름 또는 호수의 일부'),
          buildingName: z.string().optional().describe('건물 이름의 일부'),
          purpose: z.enum(SPACE_PURPOSES).optional().describe('공간 용도'),
          minCapacity: z.number().int().min(0).optional().describe('최소 수용 인원'),
          limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`최대 결과 수 (기본 ${DEFAULT_LIMIT})`),
        },
      },
      async ({ keyword, buildingName, purpose, minCapacity, limit }) => {
        const rows = this.spaces.searchSpaces({
          keyword,
          buildingName,
          purpose,
          minCapacity,
          limit: limit ?? DEFAULT_LIMIT,
        });

        if (rows.length === 0) {
          return textResult('조건에 맞는 공간이 없다. 조건을 줄여서 다시 찾아봐라.');
        }
        return textResult(formatSpaceRows(rows));
      },
    );
  }

  private registerGetSpace(server: McpServer): void {
    server.registerTool(
      'get_space',
      {
        title: '공간 상세 조회',
        description: [
          '공간 하나의 상세 정보 — 용도, 수용 인원, 면적, 소속 건물과 층, 주소 — 를 돌려준다.',
          '',
          '언제 쓰나: 특정 공간 하나를 콕 집어 물을 때. 단, spaceId를 알고 있어야 한다.',
          '언제 쓰지 않나: id를 모른다면 이 tool을 추측으로 호출하지 말고 search_spaces를 먼저 불러라. 이름만 알고 있는 경우도 마찬가지다.',
          '',
          '인자:',
          '  spaceId — search_spaces가 돌려준 id를 그대로 쓴다. 예: "B1-1F-101"',
          '',
          '반환 형태: 키:값 한 줄씩의 블록.',
          '  id: B1-1F-101',
          '  이름: 그라운드',
          '  용도: 팝업존',
          '  수용인원: 150명',
          '  면적: 330㎡',
          '  위치: 성수 플래그십 1층 101호',
        ].join('\n'),
        annotations: { readOnlyHint: true },
        inputSchema: {
          spaceId: z.string().describe('search_spaces가 돌려준 공간 id'),
        },
      },
      async ({ spaceId }) => {
        const detail = this.spaces.getSpace(spaceId);
        if (!detail) {
          return errorResult(
            `"${spaceId}"라는 공간이 없다. id를 지어내지 말고 search_spaces로 먼저 공간을 찾은 뒤 거기서 나온 id를 써라.`,
          );
        }
        return textResult(formatSpaceDetail(detail));
      },
    );
  }

  private registerGetBuildingStructure(server: McpServer): void {
    server.registerTool(
      'get_building_structure',
      {
        title: '건물 구성 조회',
        description: [
          '건물 목록, 또는 건물 하나의 층별 구성을 돌려준다.',
          '',
          '언제 쓰나: 특정 공간이 아니라 건물 단위로 물을 때. "건물이 몇 개야", "성수 플래그십은 몇 층까지 있어", "홍대 컬처몰 2층에 뭐가 있어" 같은 질문에 쓴다. 사용자가 어떤 건물이 있는지조차 모를 때 대화의 출발점으로도 좋다.',
          '언제 쓰지 않나: 조건에 맞는 공간을 찾는 거라면 search_spaces를 쓴다. 이 tool은 공간 하나하나의 정보를 주지 않는다.',
          '',
          '인자:',
          '  buildingName — 선택. 생략하면 전체 건물 목록을, 주면 그 건물의 층별 구성을 돌려준다. 이름의 일부만 줘도 된다.',
          '',
          '반환 형태:',
          '  생략 시 — 건물 / 주소 / 층 수 / 공간 수 열의 표',
          '  지정 시 — 건물 이름과 주소 한 줄 + 층 / 이름 / 공간 수 / 용도 분포 열의 표',
        ].join('\n'),
        annotations: { readOnlyHint: true },
        inputSchema: {
          buildingName: z.string().optional().describe('건물 이름의 일부. 생략하면 전체 목록'),
        },
      },
      async ({ buildingName }) => {
        if (!buildingName) {
          return textResult(formatBuildingRows(this.spaces.listBuildings()));
        }

        const result = this.spaces.getBuildingFloors(buildingName);
        if (!result) {
          const names = this.spaces.listBuildings().map((b) => b.name);
          return errorResult(`"${buildingName}"이라는 건물이 없다. 있는 건물은 ${names.join(', ')} 이다.`);
        }
        return textResult(formatFloorRows(result.building, result.rows));
      },
    );
  }

  private registerSearchEvents(server: McpServer): void {
    server.registerTool(
      'search_events',
      {
        title: '행사 이력 검색',
        description: [
          '어떤 브랜드가 언제 어느 공간에서 팝업·전시·쇼케이스를 열었는지 찾는다. 지난 행사와 예정된 행사를 모두 담고 있다.',
          '',
          '언제 쓰나: 질문에 브랜드 이름이나 시점이 들어가면 이 tool이다.',
          '  "과거에 무신사 팝업 한 공간 알려줘" → { brandName: "무신사", type: "팝업", period: "과거" }',
          '  "지금 진행 중인 팝업 있어?" → { period: "진행중", type: "팝업" }',
          '  "그라운드에서 뭐 했었어?" → { spaceId: "B1-1F-101" }  (공간을 거쳐간 브랜드를 역방향으로 찾는다)',
          '언제 쓰지 않나: 행사와 무관하게 공간 자체의 조건(수용 인원, 용도)만 따질 때는 search_spaces를 쓴다.',
          '',
          '인자 (전부 선택이고, 주는 조건은 AND로 묶인다):',
          '  brandName — 브랜드 이름의 일부. 예: "무신사"',
          `  brandCategory — 브랜드 업종. ${BRAND_CATEGORIES.join(' / ')} 중 하나.`,
          `  type — 행사 유형. ${EVENT_TYPES.join(' / ')} 중 하나.`,
          `  period — 시점. ${EVENT_PERIODS.join(' / ')} 중 하나. 오늘 날짜를 기준으로 나눈다.`,
          '  spaceId — 특정 공간에서 열린 행사만. search_spaces나 이 tool이 돌려준 id를 쓴다.',
          '  buildingName — 건물 이름의 일부. 예: "성수"',
          `  limit — 최대 결과 수 (기본 ${DEFAULT_LIMIT}, 최대 ${MAX_LIMIT})`,
          '',
          '중요: "과거에", "예전에", "했던" 처럼 지난 일을 묻는 표현이 있으면 period를 "과거"로 반드시 지정해라.',
          '빠뜨리면 아직 열리지도 않은 예정 행사가 답에 섞인다. 마찬가지로 사용자가 "팝업"이라고 하면 type도 "팝업"으로 지정해라 — 전시와 쇼케이스가 섞인다.',
          '',
          '반환 형태: 행사 / 브랜드 / 유형 / 기간 / 공간 / 건물 / spaceId 열의 표. 최근 시작순으로 정렬된다.',
          'spaceId가 같이 오므로 이어서 get_space로 그 공간의 수용 인원이나 면적을 볼 수 있다.',
        ].join('\n'),
        annotations: { readOnlyHint: true },
        inputSchema: {
          brandName: z.string().optional().describe('브랜드 이름의 일부'),
          brandCategory: z.enum(BRAND_CATEGORIES).optional().describe('브랜드 업종'),
          type: z.enum(EVENT_TYPES).optional().describe('행사 유형'),
          period: z.enum(EVENT_PERIODS).optional().describe('시점 — 과거 / 진행중 / 예정'),
          spaceId: z.string().optional().describe('특정 공간에서 열린 행사만 볼 때'),
          buildingName: z.string().optional().describe('건물 이름의 일부'),
          limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`최대 결과 수 (기본 ${DEFAULT_LIMIT})`),
        },
      },
      async ({ brandName, brandCategory, type, period, spaceId, buildingName, limit }) => {
        const rows = this.events.searchEvents({
          brandName,
          brandCategory,
          type,
          period,
          spaceId,
          buildingName,
          limit: limit ?? DEFAULT_LIMIT,
        });

        if (rows.length === 0) {
          return textResult('조건에 맞는 행사가 없다. 조건을 줄여서 다시 찾아봐라.');
        }
        return textResult(formatEventRows(rows));
      },
    );
  }
}
