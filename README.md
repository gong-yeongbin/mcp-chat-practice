# mcp-chat

Neo4j 기반 챗봇 MCP 서버 구현 방식 정리.

## MCP 서버 제작 원칙

### Tool 설계 — API가 아니라 모델의 행동을 설계한다

- REST API를 미러링하지 않는다. Endpoint 하나당 tool 하나가 아니라, 모델이 수행할 작업 단위로 묶는다.
- Tool 개수는 적게, description은 길게. Description은 언제 쓰는지/쓰면 안 되는지, 인자 예시, 반환 형태까지 담은 문서다. Description이 곧 프롬프트다.
- 출력은 토큰 예산 안에서 설계한다. Raw JSON 덤프 대신 모델이 읽기 좋은 형태로 포맷하고, 대량 결과는 `limit` + pagination 인자를 둔다.

### 구조 표준 패턴

- Transport 분리 — 로컬은 stdio, 원격은 Streamable HTTP. Server 로직과 transport를 분리해 두면 둘 다 지원하기 쉽다.
- 입력 검증은 schema로 — TS SDK는 zod schema로 tool 인자를 선언한다. 검증을 손으로 짜지 않는다.
- 에러는 throw가 아니라 `isError: true` 결과로 반환한다. 모델이 에러 메시지를 읽고 재시도하도록, 메시지에 원인과 해결 방법을 담는다.
- stdio에서 stdout은 protocol channel이다. 로그는 반드시 stderr로. `console.log` 하나가 서버를 죽인다.
- 위험한 작업은 프롬프트가 아니라 코드로 차단한다. 예를 들어 read-only tool에서 write 구문 거부, `LIMIT` 강제 주입.

### 개발 워크플로우

1. MCP Inspector로 수동 테스트 — `npx @modelcontextprotocol/inspector node dist/index.js`
2. 실제 모델로 tool 선택 시나리오 검증 — 모델이 엉뚱한 tool을 고르면 코드가 아니라 description을 고친다.
3. 비즈니스 로직(쿼리 검증기, 포매터)은 MCP와 무관한 unit test로 검증한다.

## 구현 방식 4가지

### 1. 공식 Neo4j MCP 서버 그대로 사용

Neo4j가 공식으로 제공하는 MCP 서버를 설정만으로 연결하는 방식.

- **`mcp-neo4j-cypher`** — LLM이 스키마를 조회하고 Cypher를 직접 생성해 실행하는 tool(`get_schema`, `read_cypher`, `write_cypher`)을 제공한다.
- **`mcp-neo4j-memory`** — 대화에서 나온 엔티티/관계를 지식그래프로 저장하는 장기 기억용 서버.

| 구분 | 내용 |
|------|------|
| 장점 | 코드 없이 설정만으로 바로 시작 가능 |
| 단점 | LLM이 임의 Cypher를 실행하므로 복잡한 스키마에서 정확도가 떨어지고, write 권한을 열면 위험 |
| 적합한 경우 | 프로토타입, 내부용 도구 |

### 2. Text2Cypher 방식의 자체 MCP 서버

직접 MCP 서버를 만들되, tool은 "자연어 질문 → Cypher 생성 → 실행"의 범용 구조로 두는 방식. 공식 서버와 비슷하지만 다음을 직접 제어할 수 있다.

- 스키마 설명 주입 (프롬프트에 그래프 구조 제공)
- 쿼리 검증 (read-only 강제, `LIMIT` 강제)
- 결과 포맷팅

| 구분 | 내용 |
|------|------|
| 장점 | 유연한 질의 + 안전장치를 직접 설계 가능 |
| 단점 | Cypher 생성 정확도는 여전히 LLM에 의존 |
| 적합한 경우 | 스키마가 자주 바뀌거나 질문 유형을 예측하기 어려운 경우 |

### 3. 도메인 특화 tool 방식

LLM에게 Cypher를 맡기지 않고, 도메인에 맞는 tool을 미리 정의하는 방식. 각 tool 내부에서는 파라미터화된 Cypher만 실행한다.

```
search_person(name)          → 파라미터화된 Cypher 실행
get_relationships(id, depth) → 파라미터화된 Cypher 실행
find_path(from, to)          → shortestPath 쿼리 실행
```

| 구분 | 내용 |
|------|------|
| 장점 | 쿼리가 항상 정확하고 안전하며(injection 불가), 응답 속도와 토큰 사용량이 예측 가능 |
| 단점 | 스키마가 바뀌면 tool도 수정 필요, 초기 개발 비용 존재 |
| 적합한 경우 | 프로덕션 챗봇 (가장 일반적인 선택) |

### 4. GraphRAG 방식

Neo4j의 벡터 인덱스로 유사도 검색을 한 뒤, 매칭된 노드에서 그래프를 확장(이웃 노드, 관계)해 컨텍스트를 구성하는 `retrieve(query)` tool 하나를 노출하는 방식.

```
retrieve(query)
  1. query 임베딩 → 벡터 인덱스 유사도 검색
  2. 매칭된 노드에서 그래프 확장 (이웃 노드, 관계 수집)
  3. 수집된 서브그래프를 컨텍스트로 반환
```

| 구분 | 내용 |
|------|------|
| 장점 | 문서/지식 기반 QA에서 검색 품질이 높음 |
| 단점 | 임베딩 파이프라인 구축이 추가로 필요 |
| 적합한 경우 | 문서·지식 기반 QA 챗봇 |

## 권장 조합

실무에서는 **2 + 3 혼합**이 흔한 패턴이다. 자주 쓰는 질문은 도메인 특화 tool로 처리하고, 나머지는 read-only Text2Cypher를 fallback으로 사용한다.

## 스택 참고

- TypeScript — `@modelcontextprotocol/sdk`
- Python — `FastMCP`
