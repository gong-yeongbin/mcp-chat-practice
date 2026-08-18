/**
 * in-memory 데이터(space.data.ts / event.data.ts)를 Neo4j에 적재하는 스크립트.
 *
 *   pnpm load -- --force
 *
 * Neo4jService를 쓰지 않는다. 그건 읽기 전용 세션이 보장이고 여기는 쓰기가 필요하다.
 * 드라이버를 직접 만들어 앱의 읽기 전용 규약을 건드리지 않는다.
 *
 * 그래프 모델:
 *   (:Building)-[:HAS_FLOOR]->(:Floor)-[:HAS_SPACE]->(:Space)
 *   (:Brand)-[:HELD]->(:Event)-[:AT]->(:Space)
 *
 * Event를 관계가 아니라 노드로 둔 이유: 원본 데이터의 EVENTS가 id와 4개 속성을 가진
 * 독립 레코드라 1:1로 옮겨진다. 적재 후 노드 수와 원본 배열 길이를 그대로 대조할 수 있다.
 */
import 'dotenv/config';
import neo4j, { Driver, Session } from 'neo4j-driver';

import { BRANDS, EVENTS } from '../space/event.data';
import { BUILDINGS, FLOORS, SPACES } from '../space/space.data';

/** 적재 대상 레이블. 지울 때도 이 목록만 지운다 — 같은 DB의 다른 데이터는 건드리지 않는다. */
const LABELS = ['Building', 'Floor', 'Space', 'Brand', 'Event'] as const;

/**
 * 한 트랜잭션에 넘길 행 수. 지금 데이터는 전부 합쳐 100건이 안 돼서 한 덩어리로 끝나지만,
 * 원본이 DB로 바뀌면 그대로 커진다. 그때 트랜잭션이 통째로 부풀지 않게 미리 나눠둔다.
 */
const CHUNK_SIZE = 500;

const CONSTRAINTS = LABELS.map(
  (label) =>
    `CREATE CONSTRAINT ${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
);

/** 적재 단계. 순서가 중요하다 — 관계를 잇는 쪽이 먼저 존재해야 한다. */
interface LoadStep {
  label: string;
  rows: object[];
  cypher: string;
}

const STEPS: LoadStep[] = [
  {
    label: 'Building',
    rows: BUILDINGS,
    cypher: `
      UNWIND $rows AS row
      MERGE (b:Building {id: row.id})
      SET b.name = row.name, b.address = row.address`,
  },
  {
    label: 'Floor',
    rows: FLOORS,
    cypher: `
      UNWIND $rows AS row
      MATCH (b:Building {id: row.buildingId})
      MERGE (f:Floor {id: row.id})
      SET f.level = row.level, f.name = row.name
      MERGE (b)-[:HAS_FLOOR]->(f)`,
  },
  {
    label: 'Space',
    rows: SPACES,
    cypher: `
      UNWIND $rows AS row
      MATCH (f:Floor {id: row.floorId})
      MERGE (s:Space {id: row.id})
      SET s.name = row.name, s.number = row.number, s.purpose = row.purpose,
          s.capacity = row.capacity, s.areaSqm = row.areaSqm
      MERGE (f)-[:HAS_SPACE]->(s)`,
  },
  {
    label: 'Brand',
    rows: BRANDS,
    cypher: `
      UNWIND $rows AS row
      MERGE (b:Brand {id: row.id})
      SET b.name = row.name, b.category = row.category`,
  },
  {
    label: 'Event',
    rows: EVENTS,
    cypher: `
      UNWIND $rows AS row
      MATCH (br:Brand {id: row.brandId})
      MATCH (s:Space {id: row.spaceId})
      MERGE (e:Event {id: row.id})
      SET e.title = row.title, e.type = row.type,
          e.startDate = row.startDate, e.endDate = row.endDate
      MERGE (br)-[:HELD]->(e)
      MERGE (e)-[:AT]->(s)`,
  },
];

/** 배열을 size 단위로 나눈다. 마지막 덩어리는 size보다 작을 수 있다. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error(`chunk 크기는 1 이상이어야 한다 (받은 값: ${size})`);

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** 적재 전에 원본이 스스로 온전한지 본다. DB에 넣다가 중간에 실패하는 것보다 낫다. */
export function findBrokenReferences(): string[] {
  const floorIds = new Set(FLOORS.map((f) => f.id));
  const buildingIds = new Set(BUILDINGS.map((b) => b.id));
  const spaceIds = new Set(SPACES.map((s) => s.id));
  const brandIds = new Set(BRANDS.map((b) => b.id));

  return [
    ...FLOORS.filter((f) => !buildingIds.has(f.buildingId)).map(
      (f) => `Floor ${f.id} → 없는 Building ${f.buildingId}`,
    ),
    ...SPACES.filter((s) => !floorIds.has(s.floorId)).map((s) => `Space ${s.id} → 없는 Floor ${s.floorId}`),
    ...EVENTS.filter((e) => !spaceIds.has(e.spaceId)).map((e) => `Event ${e.id} → 없는 Space ${e.spaceId}`),
    ...EVENTS.filter((e) => !brandIds.has(e.brandId)).map((e) => `Event ${e.id} → 없는 Brand ${e.brandId}`),
  ];
}

async function wipe(session: Session): Promise<void> {
  const predicate = LABELS.map((label) => `n:${label}`).join(' OR ');
  await session.run(`MATCH (n) WHERE ${predicate} DETACH DELETE n`);
}

async function load(driver: Driver, database: string | undefined): Promise<void> {
  const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });

  try {
    for (const statement of CONSTRAINTS) {
      await session.run(statement);
    }
    console.log(`제약조건 ${CONSTRAINTS.length}개 확인`);

    await wipe(session);
    console.log(`기존 ${LABELS.join('/')} 노드 삭제`);

    for (const step of STEPS) {
      const chunks = chunk(step.rows, CHUNK_SIZE);
      for (const rows of chunks) {
        await session.run(step.cypher, { rows });
      }
      console.log(`${step.label}: ${step.rows.length}건 (${chunks.length} chunk)`);
    }
  } finally {
    await session.close();
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--force')) {
    console.error(
      '이 스크립트는 기존 Building/Floor/Space/Brand/Event 노드를 모두 지운다.\n' +
        '실행하려면 --force 를 붙여라:  pnpm load -- --force',
    );
    process.exit(1);
  }

  const broken = findBrokenReferences();
  if (broken.length > 0) {
    console.error(`원본 데이터의 참조가 깨져 있다:\n  ${broken.join('\n  ')}`);
    process.exit(1);
  }

  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    console.error('.env에 NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD 가 필요하다.');
    process.exit(1);
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  try {
    await driver.verifyConnectivity();
    await load(driver, process.env.NEO4J_DATABASE || undefined);
    console.log('적재 완료');
  } finally {
    await driver.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
