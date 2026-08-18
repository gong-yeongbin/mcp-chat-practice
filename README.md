# mcp-chat

공간 대관·행사 이력을 다루는 챗봇용 MCP 서버. NestJS + 공식 `@modelcontextprotocol/sdk`, Streamable HTTP 전용.

설계 배경과 구현 방식 비교는 [DOCUMENT.md](./DOCUMENT.md)에 있다.

## 빠른 시작

```bash
docker compose up -d      # Neo4j (bolt 7687 / browser 7474)
pnpm install
pnpm start:dev            # http://localhost:3000/mcp
```

`.env`에 Neo4j 접속 정보가 있어야 한다. 값은 `docker-compose.yml`의 `NEO4J_PASSWORD` 기본값과 일치해야 한다. Neo4j 없이도 서버는 뜨고, Neo4j를 쓰는 tool만 실패한다.

## 노출하는 tool

두 갈래가 공존한다. 자주 쓰는 질문은 도메인 tool이 받고, 그것으로 답할 수 없는 질문만 `read_cypher`로 떨어진다.

| tool | 데이터 소스 | 하는 일 |
|---|---|---|
| `search_spaces` | in-memory | 용도·수용인원·건물·키워드로 공간 검색 |
| `get_space` | in-memory | 공간 하나의 상세 (id 필요) |
| `get_building_structure` | in-memory | 건물 목록 또는 층별 구성 |
| `search_events` | in-memory | 브랜드·유형·시점으로 행사 이력 검색 |
| `get_schema` | Neo4j | 그래프 스키마 조회 |
| `read_cypher` | Neo4j | 검증을 통과한 읽기 전용 Cypher 실행 |

도메인 tool 4개는 모델이 쿼리를 쓰지 않는다. 쿼리는 코드에 있고 모델은 인자만 채운다.

`read_cypher`는 모델이 작성한 Cypher를 실행 전에 코드로 막는다 — 쓰기 구문 거부, 프로시저 허용목록, `LIMIT` 강제 주입. 문자열 리터럴이나 주석 안의 키워드는 오탐하지 않도록 따옴표 상태를 따라간다.

## 동작 방식

### 요청 한 번의 흐름

```
모델          "과거에 무신사 팝업 한 공간 알려줘"
  │
  │  tools/call  { name: "search_events",
  │                arguments: { brandName: "무신사", type: "팝업", period: "과거" } }
  ▼
POST /mcp     McpController — 요청마다 McpServer + Transport를 새로 만든다
  ▼
zod           inputSchema로 인자 검증. 타입·enum·범위가 안 맞으면 여기서 끝
  ▼
Service       EventService.searchEvents() — 필터링과 정렬. MCP를 모른다
  ▼
Formatter     결과 배열 → markdown 표
  ▼
모델          | 행사 | 브랜드 | 유형 | 기간 | 공간 | 건물 | spaceId |
              | 무신사 테라스 팝업 | 무신사 | 팝업 | 2025-05-01 ~ ... |
```

모델이 보는 것은 tool 이름, description, 인자 스키마, 그리고 돌아온 **텍스트**뿐이다. 쿼리도 데이터 구조도 보지 않는다.

### 두 갈래의 데이터 경로

```
                     ┌─ 도메인 tool 4개 ─→ SpaceService / EventService ─→ in-memory 배열
tools/call ─→ 라우팅 ─┤
                     └─ read_cypher ─→ 검증기 ─→ Neo4jService ─→ Neo4j
                        get_schema  ─→ SchemaService ─┘
```

**도메인 tool**은 모델에게서 쿼리 작성 권한을 뺏는다. 쿼리는 코드에 있고 모델은 인자만 채우므로 결과가 항상 정확하고 injection이 구조적으로 불가능하다. 대신 tool이 다루지 않는 질문에는 답할 수 없다.

**`read_cypher`**는 그 반대다. 어떤 질문이든 받을 수 있지만 모델이 쓴 쿼리를 믿을 수 없어서, 실행 전에 코드로 거른다.

```
모델이 쓴 Cypher
  ▼ 주석 제거          실행 쿼리에서 지운다. 안 그러면 뒤에 붙인 LIMIT이 주석에 먹힌다
  ▼ 문자열 리터럴 마스킹  n.name = 'DELETE' 를 쓰기 구문으로 오해하지 않도록
  ▼ 레이블·프로퍼티 마스킹 (n:Set), n.merge 를 키워드로 오해하지 않도록
  ▼ statement 개수      세미콜론으로 여러 개를 이어 붙였는지
  ▼ 쓰기 구문 15종       CREATE / MERGE / DELETE / SET / DROP ...
  ▼ 프로시저 허용목록     db.labels, db.schema.* 등 읽기 전용만
  ▼ LIMIT 보장          없으면 주입, 상한을 넘으면 낮춤
실행
```

거부되면 예외를 던지지 않고 **이유를 담은 텍스트를 `isError: true`로 돌려준다.** 모델이 메시지를 읽고 스스로 고쳐 재시도해야 하기 때문이다. Neo4j 접속 정보가 없을 때도 마찬가지로, 서버는 정상 기동하고 DB를 쓰는 tool만 실패한다.

### 지금은 같은 데이터가 두 곳에 있다

`pnpm load -- --force`로 in-memory 데이터를 그래프에 적재한 상태라, 공간·행사 데이터가 코드와 Neo4j 양쪽에 있다. 도메인 tool은 코드를 보고, `read_cypher`는 그래프를 본다.

과도기이지만 의도한 배치다. 도메인 tool로 답할 수 없는 질문 — "그라운드를 거쳐간 브랜드는", "무신사와 같은 공간을 쓴 다른 브랜드는" 같은 역방향·다중 홉 탐색 — 을 `read_cypher`가 fallback으로 받는다. 그래프 모델은 이렇다.

```
(:Building)-[:HAS_FLOOR]->(:Floor)-[:HAS_SPACE]->(:Space)
(:Brand)-[:HELD]->(:Event)-[:AT]->(:Space)
```

### 세션을 두지 않는다

Streamable HTTP는 세션을 유지하는 모드와 그렇지 않은 모드가 있는데, 이 서버는 후자다. 요청마다 `McpServer`와 transport를 새로 만들고 응답이 끝나면 버린다. 서버가 들고 있는 대화 상태가 없으므로 인스턴스를 여러 대로 늘려도 그대로 동작한다. 대신 세션 기반 SSE 스트림(GET)과 세션 종료(DELETE)는 지원하지 않고 405를 돌려준다.

## 구조

```
src/
  main.ts                  진입점 — Nest HTTP 부트스트랩
  app.module.ts            ConfigModule(전역) + McpModule

  mcp/                     MCP 프로토콜 계층
    mcp.controller.ts        POST /mcp — 요청마다 server+transport 생성 (stateless)
    mcp-server.factory.ts    McpServer 조립 + Neo4j tool 등록
    tools/
      space-tools.registrar.ts   도메인 tool 4개 등록 (description = 프롬프트)

  space/                   도메인 계층 — DB 없이 도는 부분
    space.data.ts            건물·층·공간 (in-memory)
    event.data.ts            브랜드·행사 이력 (in-memory)
    space.service.ts         공간 조회
    event.service.ts         행사 조회 (시점 필터의 기준일을 주입받는다)
    space-formatter.ts       결과 → 표 / 키:값 블록

  neo4j/                   Neo4j 접근 계층
    neo4j.service.ts         드라이버 lazy 초기화, 읽기 전용 세션
    schema.service.ts        db.schema.* 로 스키마 수집 (APOC 불필요)

  cypher/                  Cypher 취급 유틸
    cypher-validator.ts      읽기 전용 검증 + LIMIT 강제
    result-formatter.ts      Neo4j 결과 → markdown 표 (formatRows는 공용)
    schema-formatter.ts      스키마 → 압축 텍스트

scripts/probe.mjs          실행 중인 서버에 붙어 tool을 차례로 호출
```

계층이 지키는 규칙 두 가지.

**tool 계층은 얇게, 서비스 계층은 두껍게.** tool은 인자 검증과 포맷만 하고, 로직은 MCP 없이 테스트되는 평범한 함수에 둔다. 그래서 테스트 67개 중 MCP를 띄우는 건 하나도 없다.

**에러는 throw하지 않는다.** 원인과 해결 방법을 담아 `isError: true` 결과로 돌려준다. 모델이 메시지를 읽고 스스로 고쳐 재시도해야 하기 때문이다.

### 데이터가 코드 안에 있는 이유

`space.data.ts` / `event.data.ts`는 임시다. tool을 몇 개로 쪼갤지, description을 어떻게 써야 모델이 올바른 tool을 고르는지는 저장소와 무관한 문제라, DB를 붙이기 전에 그것부터 확인하려고 코드에 뒀다.

교체 시점에는 `SpaceService` / `EventService` 내부만 바뀐다. tool 계층은 두 서비스의 메서드 시그니처에만 의존한다.

## 개발

```bash
pnpm test          # 67개 — 검증기, 포매터, 조회 로직
pnpm build
pnpm probe         # 서버가 떠 있을 때, tool 호출 결과를 눈으로 확인
pnpm inspector     # MCP Inspector UI (Streamable HTTP / http://localhost:3000/mcp)
```

세 가지가 각각 다른 것을 잡는다. `pnpm test`는 **로직**, `pnpm probe`는 **배선**(tool이 실제로 노출되는지, 결과가 어떤 텍스트로 도착하는지), 그리고 실제 모델에 붙이는 것은 **description**을 검증한다.

모델을 붙이려면:

```bash
claude mcp add --transport http mcp-chat http://localhost:3000/mcp
```

서버를 띄운 채로 새 세션에서 물어보면 된다. 모델이 엉뚱한 tool을 고르면 코드가 아니라 description을 고친다.
