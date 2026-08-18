import { CypherValidationError, validateReadOnlyCypher } from './cypher-validator';

const MAX = 100;

describe('validateReadOnlyCypher', () => {
  describe('쓰기 구문 차단', () => {
    it.each([
      'CREATE (n:Person {name: "a"})',
      'MATCH (n) DETACH DELETE n',
      'MATCH (n) SET n.name = "a"',
      'MERGE (n:Person {id: 1})',
      'MATCH (n) REMOVE n:Person',
      'DROP INDEX person_name',
      'MATCH (n) FOREACH (x IN [1] | SET n.v = x)',
      'LOAD CSV FROM "file:///a.csv" AS row RETURN row',
    ])('거부한다: %s', (cypher) => {
      expect(() => validateReadOnlyCypher(cypher, MAX)).toThrow(CypherValidationError);
    });

    it('문자열 리터럴 안의 쓰기 키워드는 오탐하지 않는다', () => {
      expect(validateReadOnlyCypher("MATCH (n) WHERE n.name = 'DELETE' RETURN n", MAX)).toBe(
        "MATCH (n) WHERE n.name = 'DELETE' RETURN n LIMIT 100",
      );
    });

    it('레이블·프로퍼티 이름이 키워드와 같아도 오탐하지 않는다', () => {
      expect(validateReadOnlyCypher('MATCH (n:Set) WHERE n.merge = 1 RETURN n', MAX)).toBe(
        'MATCH (n:Set) WHERE n.merge = 1 RETURN n LIMIT 100',
      );
    });

    it('주석 안의 쓰기 구문은 주석째로 제거한다 — LIMIT이 주석에 먹히지 않아야 한다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n // CREATE (x)', MAX)).toBe(
        'MATCH (n) RETURN n LIMIT 100',
      );
    });

    it('문자열 안의 //는 주석이 아니다', () => {
      expect(validateReadOnlyCypher("MATCH (n) WHERE n.url = 'http://a' RETURN n", MAX)).toBe(
        "MATCH (n) WHERE n.url = 'http://a' RETURN n LIMIT 100",
      );
    });

    it('블록 주석도 제거한다', () => {
      expect(validateReadOnlyCypher('MATCH (n) /* SET n.x = 1 */ RETURN n', MAX)).toBe(
        'MATCH (n)   RETURN n LIMIT 100',
      );
    });
  });

  describe('프로시저 호출', () => {
    it('허용 목록의 프로시저는 통과한다', () => {
      expect(validateReadOnlyCypher('CALL db.labels() YIELD label RETURN label', MAX)).toBe(
        'CALL db.labels() YIELD label RETURN label LIMIT 100',
      );
    });

    it('허용 목록에 없는 프로시저는 거부한다', () => {
      expect(() => validateReadOnlyCypher('CALL apoc.periodic.iterate("a", "b", {})', MAX)).toThrow(
        /허용되지 않은 프로시저/,
      );
    });

    it('CALL 서브쿼리는 프로시저가 아니므로 허용한다', () => {
      expect(
        validateReadOnlyCypher('MATCH (n) CALL { WITH n MATCH (n)--(m) RETURN m } RETURN m', MAX),
      ).toContain('CALL {');
    });
  });

  describe('statement 개수', () => {
    it('세미콜론으로 나뉜 여러 statement를 거부한다', () => {
      expect(() => validateReadOnlyCypher('MATCH (n) RETURN n; MATCH (m) RETURN m', MAX)).toThrow(
        /하나의 Cypher statement/,
      );
    });

    it('끝에 붙은 세미콜론 하나는 허용하고 제거한다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n;', MAX)).toBe('MATCH (n) RETURN n LIMIT 100');
    });
  });

  describe('LIMIT 강제', () => {
    it('LIMIT이 없으면 주입한다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n', MAX)).toBe('MATCH (n) RETURN n LIMIT 100');
    });

    it('상한 이하의 LIMIT은 그대로 둔다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n LIMIT 10', MAX)).toBe('MATCH (n) RETURN n LIMIT 10');
    });

    it('상한을 넘는 LIMIT은 상한으로 낮춘다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n LIMIT 5000', MAX)).toBe('MATCH (n) RETURN n LIMIT 100');
    });

    it('LIMIT 뒤에 주석이 붙어도 상한을 적용한다', () => {
      expect(validateReadOnlyCypher('MATCH (n) RETURN n LIMIT 5000 // 많이', MAX)).toBe(
        'MATCH (n) RETURN n LIMIT 100',
      );
    });

    it('리터럴이 아닌 LIMIT은 거부한다', () => {
      expect(() => validateReadOnlyCypher('MATCH (n) RETURN n LIMIT $n', MAX)).toThrow(/양의 정수 리터럴/);
    });

    it('빈 쿼리를 거부한다', () => {
      expect(() => validateReadOnlyCypher('   ', MAX)).toThrow(CypherValidationError);
    });
  });
});
