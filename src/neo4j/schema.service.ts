import { Injectable } from '@nestjs/common';

import { GraphSchema, PropertySchema } from '../cypher/schema-formatter';
import { Neo4jService } from './neo4j.service';

/** db.schema.relTypeProperties는 relType을 ":`ACTED_IN`" 형태로 준다. */
function unwrapRelType(relType: string): string {
  return relType.replace(/^:/, '').replace(/`/g, '');
}

function collectProperties(
  rows: { key: string; propertyName: string | null; propertyTypes: string[] | null }[],
): Map<string, PropertySchema[]> {
  const byKey = new Map<string, PropertySchema[]>();

  for (const row of rows) {
    const properties = byKey.get(row.key) ?? [];
    if (row.propertyName) {
      properties.push({ name: row.propertyName, types: row.propertyTypes ?? [] });
    }
    byKey.set(row.key, properties);
  }
  return byKey;
}

@Injectable()
export class SchemaService {
  constructor(private readonly neo4j: Neo4jService) {}

  /** APOC 없이 내장 프로시저만으로 스키마를 읽는다. */
  async fetch(): Promise<GraphSchema> {
    const [nodeRows, relRows, patternRows] = await Promise.all([
      this.neo4j.read(
        'CALL db.schema.nodeTypeProperties() YIELD nodeLabels, propertyName, propertyTypes RETURN nodeLabels, propertyName, propertyTypes',
      ),
      this.neo4j.read(
        'CALL db.schema.relTypeProperties() YIELD relType, propertyName, propertyTypes RETURN relType, propertyName, propertyTypes',
      ),
      this.neo4j.read('CALL db.schema.visualization() YIELD nodes, relationships RETURN nodes, relationships'),
    ]);

    const nodeProperties = collectProperties(
      nodeRows.map((r) => ({
        key: (r.get('nodeLabels') as string[]).join(':'),
        propertyName: r.get('propertyName') as string | null,
        propertyTypes: r.get('propertyTypes') as string[] | null,
      })),
    );

    const relProperties = collectProperties(
      relRows.map((r) => ({
        key: unwrapRelType(r.get('relType') as string),
        propertyName: r.get('propertyName') as string | null,
        propertyTypes: r.get('propertyTypes') as string[] | null,
      })),
    );

    return {
      nodes: [...nodeProperties].map(([label, properties]) => ({ label, properties })),
      relationships: [...relProperties].map(([type, properties]) => ({ type, properties })),
      patterns: this.extractPatterns(patternRows[0]),
    };
  }

  /**
   * db.schema.visualization()은 가상 노드/관계를 준다.
   *
   * 관계의 start/end는 노드 객체가 아니라 가상 노드의 id다. 레이블 이름은 노드의
   * properties.name에 들어 있으므로, id로 노드를 찾아 (from)-[:TYPE]->(to)를 만든다.
   */
  private extractPatterns(row: { get(key: string): unknown } | undefined): GraphSchema['patterns'] {
    if (!row) return [];

    const nodes = (row.get('nodes') ?? []) as { elementId: string; properties: { name?: string } }[];
    const nameByElementId = new Map(nodes.map((node) => [node.elementId, node.properties.name ?? '?']));

    const relationships = (row.get('relationships') ?? []) as {
      type: string;
      startNodeElementId: string;
      endNodeElementId: string;
    }[];

    return relationships.map((rel) => ({
      from: nameByElementId.get(rel.startNodeElementId) ?? '?',
      type: rel.type,
      to: nameByElementId.get(rel.endNodeElementId) ?? '?',
    }));
  }
}
