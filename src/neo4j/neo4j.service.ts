import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Record as Neo4jRecord } from 'neo4j-driver';

/** 접속 정보가 없거나 연결에 실패했을 때 — tool 호출 시점에만 터진다. */
export class Neo4jUnavailableError extends Error {}

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * 드라이버를 첫 사용 시점에 만든다.
   * 부팅 시점에 만들면 Neo4j가 없을 때 서버 자체가 뜨지 않는다 — MCP 서버는 뜨고,
   * DB를 쓰는 tool만 실패하는 편이 낫다.
   */
  private async getDriver(): Promise<Driver> {
    if (this.driver) return this.driver;

    const uri = this.config.get<string>('NEO4J_URI');
    const username = this.config.get<string>('NEO4J_USERNAME');
    const password = this.config.get<string>('NEO4J_PASSWORD');

    if (!uri || !username || !password) {
      throw new Neo4jUnavailableError(
        'Neo4j 접속 정보가 설정되지 않았다. .env에 NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD를 채워야 한다.',
      );
    }

    const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    try {
      await driver.verifyConnectivity();
    } catch (error) {
      await driver.close();
      throw new Neo4jUnavailableError(
        `Neo4j(${uri})에 연결하지 못했다: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(`Neo4j 연결됨: ${uri}`);
    this.driver = driver;
    return driver;
  }

  /** 읽기 전용 세션으로 실행한다. 검증기를 통과한 쿼리만 여기로 들어와야 한다. */
  async read(cypher: string, params: Record<string, unknown> = {}): Promise<Neo4jRecord[]> {
    const driver = await this.getDriver();
    const session = driver.session({
      database: this.config.get<string>('NEO4J_DATABASE') || undefined,
      defaultAccessMode: neo4j.session.READ,
    });

    try {
      const result = await session.executeRead((tx) => tx.run(cypher, params));
      return result.records;
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver?.close();
  }
}
