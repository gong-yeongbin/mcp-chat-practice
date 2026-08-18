import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { CypherValidationError, validateReadOnlyCypher } from '../cypher/cypher-validator';
import { formatRecords } from '../cypher/result-formatter';
import { formatSchema } from '../cypher/schema-formatter';
import { Neo4jService, Neo4jUnavailableError } from '../neo4j/neo4j.service';
import { SchemaService } from '../neo4j/schema.service';
import { SpaceToolsRegistrar } from './tools/space-tools.registrar';

const SERVER_INFO = { name: 'mcp-chat', version: '0.1.0' };

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** 에러는 throw하지 않고 결과로 돌려준다. 모델이 메시지를 읽고 스스로 고쳐 재시도하게 하기 위함이다. */
function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly config: ConfigService,
    private readonly neo4j: Neo4jService,
    private readonly schema: SchemaService,
    private readonly spaceTools: SpaceToolsRegistrar,
  ) {}

  /** 요청마다 새 McpServer를 만든다 (stateless Streamable HTTP). */
  create(): McpServer {
    const server = new McpServer(SERVER_INFO);

    this.registerGetSchema(server);
    this.registerReadCypher(server);
    this.spaceTools.register(server);

    return server;
  }

  private registerGetSchema(server: McpServer): void {
    server.registerTool(
      'get_schema',
      {
        title: '그래프 스키마 조회',
        description: [
          '연결된 Neo4j 데이터베이스의 스키마 — 노드 레이블, 관계 타입, 각각의 프로퍼티, 그리고 어떤 레이블이 어떤 관계로 연결되는지 — 를 돌려준다.',
          '',
          '언제 쓰나: read_cypher로 쿼리를 작성하기 전에 반드시 한 번 호출한다. 스키마를 모른 채 레이블이나 프로퍼티 이름을 추측하면 거의 항상 빈 결과가 나온다.',
          '언제 쓰지 않나: 같은 대화에서 이미 호출했다면 다시 부르지 않는다. 스키마는 대화 도중 바뀌지 않는다.',
          '',
          '인자: 없다.',
          '반환 형태:',
          '  # 노드 (2)',
          '  (:Person) — name: String, born: Long',
          '  (:Movie) — title: String',
          '  # 관계 (1)',
          '  [:ACTED_IN] — roles: StringArray',
          '  # 연결 패턴 (1)',
          '  (:Person)-[:ACTED_IN]->(:Movie)',
        ].join('\n'),
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {},
      },
      async () => {
        try {
          return textResult(formatSchema(await this.schema.fetch()));
        } catch (error) {
          return this.toErrorResult(error);
        }
      },
    );
  }

  private registerReadCypher(server: McpServer): void {
    const maxLimit = Number(this.config.get('CYPHER_DEFAULT_LIMIT') ?? 100);

    server.registerTool(
      'read_cypher',
      {
        title: '읽기 전용 Cypher 실행',
        description: [
          '직접 작성한 Cypher를 읽기 전용으로 실행하고 결과를 표로 돌려준다.',
          '',
          '언제 쓰나: 사용자의 질문에 답하기 위해 그래프에서 데이터를 읽어야 할 때. 호출 전에 get_schema로 레이블과 프로퍼티 이름을 확인한다.',
          '언제 쓰지 않나: 데이터를 만들거나 고치거나 지울 때는 쓸 수 없다. CREATE / MERGE / SET / DELETE / REMOVE / DROP 같은 쓰기 구문은 실행 전에 거부된다. 허용되는 프로시저는 db.labels, db.relationshipTypes, db.schema.* 등 읽기 전용 내장 프로시저뿐이다.',
          '',
          '인자:',
          '  cypher — 실행할 Cypher 한 개. 세미콜론으로 여러 statement를 이어 붙일 수 없다.',
          `  params — 선택. 쿼리 안의 $이름 파라미터에 넣을 값. 사용자 입력은 문자열로 이어 붙이지 말고 반드시 params로 넘긴다.`,
          '',
          '예시:',
          '  cypher: "MATCH (p:Person)-[:ACTED_IN]->(m:Movie) WHERE p.name = $name RETURN m.title AS title"',
          '  params: {"name": "Tom Hanks"}',
          '',
          `반환 형태: markdown 표와 행 수. LIMIT을 쓰지 않으면 ${maxLimit}이 자동으로 붙고, ${maxLimit}보다 큰 LIMIT은 ${maxLimit}으로 낮춰진다.`,
          '  | title |',
          '  | --- |',
          '  | Forrest Gump |',
          '',
          '  1 rows',
          '',
          '에러가 나면 이유가 담긴 메시지가 온다. 메시지를 읽고 쿼리를 고쳐 다시 호출해라.',
        ].join('\n'),
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
          cypher: z.string().describe('실행할 읽기 전용 Cypher 한 개'),
          params: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('쿼리 안 $파라미터에 바인딩할 값'),
        },
      },
      async ({ cypher, params }) => {
        try {
          const safeCypher = validateReadOnlyCypher(cypher, maxLimit);
          this.logger.log(`read_cypher: ${safeCypher}`);
          return textResult(formatRecords(await this.neo4j.read(safeCypher, params ?? {})));
        } catch (error) {
          return this.toErrorResult(error);
        }
      },
    );
  }

  private toErrorResult(error: unknown): CallToolResult {
    if (error instanceof CypherValidationError || error instanceof Neo4jUnavailableError) {
      return errorResult(error.message);
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`tool 실행 실패: ${message}`);
    return errorResult(`쿼리 실행에 실패했다: ${message}`);
  }
}
