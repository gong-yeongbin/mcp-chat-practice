export interface PropertySchema {
  name: string;
  types: string[];
}

export interface GraphSchema {
  nodes: { label: string; properties: PropertySchema[] }[];
  relationships: { type: string; properties: PropertySchema[] }[];
  patterns: { from: string; type: string; to: string }[];
}

function formatProperties(properties: PropertySchema[]): string {
  if (properties.length === 0) return '(속성 없음)';
  return properties.map((p) => `${p.name}: ${p.types.join('|')}`).join(', ');
}

/**
 * 스키마를 모델이 Cypher를 쓸 때 바로 참고할 수 있는 형태로 만든다.
 * JSON 덤프보다 짧고, 레이블·관계 타입·연결 방향이 한눈에 보인다.
 */
export function formatSchema(schema: GraphSchema): string {
  if (schema.nodes.length === 0 && schema.relationships.length === 0) {
    return '그래프가 비어 있다. 노드도 관계도 없다.';
  }

  const sections = [
    `# 노드 (${schema.nodes.length})`,
    ...schema.nodes.map((n) => `(:${n.label}) — ${formatProperties(n.properties)}`),
    '',
    `# 관계 (${schema.relationships.length})`,
    ...schema.relationships.map((r) => `[:${r.type}] — ${formatProperties(r.properties)}`),
  ];

  if (schema.patterns.length > 0) {
    sections.push(
      '',
      `# 연결 패턴 (${schema.patterns.length})`,
      ...schema.patterns.map((p) => `(:${p.from})-[:${p.type}]->(:${p.to})`),
    );
  }

  return sections.join('\n');
}
