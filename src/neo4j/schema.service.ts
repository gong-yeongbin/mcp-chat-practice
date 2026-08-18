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

  /** db.schema.visualization()은 가상 노드/관계를 준다. 이름만 뽑아 (from)-[:TYPE]->(to)로 만든다. */
  private extractPatterns(row: { get(key: string): unknown } | undefined): GraphSchema['patterns'] {
    if (!row) return [];

    const relationships = (row.get('relationships') ?? []) as {
      type: string;
      start: { properties: { name?: string } };
      end: { properties: { name?: string } };
    }[];

    return relationships.map((rel) => ({
      from: rel.start.properties.name ?? '?',
      type: rel.type,
      to: rel.end.properties.name ?? '?',
    }));
  }
}
