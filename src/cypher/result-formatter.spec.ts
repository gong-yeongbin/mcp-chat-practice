import neo4j, { Record as Neo4jRecord, types } from 'neo4j-driver';

import { formatRecords } from './result-formatter';

function record(fields: Record<string, unknown>): Neo4jRecord {
  const keys = Object.keys(fields);
  return new Neo4jRecord(keys, keys.map((k) => fields[k]));
}

describe('formatRecords', () => {
  it('결과가 없으면 빈 표 대신 안내 문구를 준다', () => {
    expect(formatRecords([])).toBe('결과 없음 (0 rows).');
  });

  it('markdown 표와 행 수를 함께 준다', () => {
    const output = formatRecords([record({ name: 'Alice', age: neo4j.int(30) })]);

    expect(output).toBe(['| name | age |', '| --- | --- |', '| Alice | 30 |', '', '1 rows'].join('\n'));
  });

  it('Node를 레이블과 프로퍼티로 압축한다', () => {
    const node = new types.Node(neo4j.int(1), ['Person'], { name: 'Alice', age: neo4j.int(30) });

    expect(formatRecords([record({ n: node })])).toContain('(:Person {"name":"Alice","age":30})');
  });

  it('Relationship을 타입과 프로퍼티로 압축한다', () => {
    const rel = new types.Relationship(neo4j.int(1), neo4j.int(2), neo4j.int(3), 'KNOWS', { since: neo4j.int(2020) });

    expect(formatRecords([record({ r: rel })])).toContain('[:KNOWS {"since":2020}]');
  });

  it('표를 깨뜨리는 파이프와 줄바꿈을 이스케이프한다', () => {
    const output = formatRecords([record({ text: 'a|b\nc' })]);

    expect(output).toContain('| a\\|b c |');
  });

  it('긴 값은 잘라낸다', () => {
    const output = formatRecords([record({ text: 'x'.repeat(500) })]);

    expect(output).toContain('…');
    expect(output.split('\n')[2].length).toBeLessThan(320);
  });

  it('safe range를 넘는 정수는 문자열로 보존한다', () => {
    const huge = neo4j.int('9007199254740993');

    expect(formatRecords([record({ big: huge })])).toContain('| 9007199254740993 |');
  });
});
