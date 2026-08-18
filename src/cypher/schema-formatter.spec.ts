import { formatSchema } from './schema-formatter';

describe('formatSchema', () => {
  it('비어 있는 그래프를 알린다', () => {
    expect(formatSchema({ nodes: [], relationships: [], patterns: [] })).toBe(
      '그래프가 비어 있다. 노드도 관계도 없다.',
    );
  });

  it('노드·관계·연결 패턴을 섹션으로 나눠 출력한다', () => {
    const output = formatSchema({
      nodes: [{ label: 'Person', properties: [{ name: 'name', types: ['String'] }] }],
      relationships: [{ type: 'ACTED_IN', properties: [] }],
      patterns: [{ from: 'Person', type: 'ACTED_IN', to: 'Movie' }],
    });

    expect(output).toBe(
      [
        '# 노드 (1)',
        '(:Person) — name: String',
        '',
        '# 관계 (1)',
        '[:ACTED_IN] — (속성 없음)',
        '',
        '# 연결 패턴 (1)',
        '(:Person)-[:ACTED_IN]->(:Movie)',
      ].join('\n'),
    );
  });

  it('연결 패턴이 없으면 그 섹션을 생략한다', () => {
    const output = formatSchema({
      nodes: [{ label: 'Person', properties: [] }],
      relationships: [],
      patterns: [],
    });

    expect(output).not.toContain('연결 패턴');
  });
});
