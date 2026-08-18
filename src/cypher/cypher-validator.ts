/**
 * read_cypher tool에 들어온 Cypher를 실행 전에 검증한다.
 *
 * 프롬프트로 "읽기만 해라"라고 부탁하는 대신 코드로 차단한다.
 *  - 쓰기 구문(CREATE/MERGE/DELETE/SET/...)이 있으면 거부
 *  - 허용 목록에 없는 프로시저 CALL 거부
 *  - 여러 statement 거부
 *  - LIMIT이 없으면 주입, 상한을 넘으면 낮춘다
 */

export class CypherValidationError extends Error {}

/** 쓰기·관리 구문. 하나라도 나오면 거부한다. */
const WRITE_KEYWORDS = [
  'CREATE',
  'MERGE',
  'DELETE',
  'DETACH',
  'SET',
  'REMOVE',
  'DROP',
  'FOREACH',
  'LOAD',
  'GRANT',
  'DENY',
  'REVOKE',
  'ALTER',
  'RENAME',
  'TERMINATE',
];

/** CALL로 부를 수 있는 읽기 전용 프로시저. 그 외 프로시저는 모두 거부한다. */
const ALLOWED_PROCEDURES = [
  'db.labels',
  'db.relationshiptypes',
  'db.propertykeys',
  'db.schema.visualization',
  'db.schema.nodetypeproperties',
  'db.schema.reltypeproperties',
  'db.index.fulltext.querynodes',
  'db.index.fulltext.queryrelationships',
];

/**
 * 주석을 제거한다. 실행 쿼리 자체에서 지워야 뒤에 붙인 LIMIT이 주석에 먹히지 않는다.
 * 문자열 리터럴 안의 `//`(예: 'file://a')를 주석으로 오인하지 않도록 따옴표 상태를 따라간다.
 */
function stripComments(cypher: string): string {
  let out = '';
  let quote: string | null = null;

  for (let i = 0; i < cypher.length; i++) {
    const ch = cypher[i];

    if (quote) {
      out += ch;
      if (ch === '\\' && quote !== '`') {
        out += cypher[++i] ?? '';
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
    } else if (ch === '/' && cypher[i + 1] === '/') {
      while (i < cypher.length && cypher[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && cypher[i + 1] === '*') {
      const end = cypher.indexOf('*/', i + 2);
      i = end === -1 ? cypher.length : end + 1;
      out += ' ';
    } else {
      out += ch;
    }
  }
  return out;
}

/** 키워드·프로시저 스캔용으로 문자열 리터럴 내용을 지운다. (주석은 이미 제거된 입력을 받는다) */
function stripLiterals(cypher: string): string {
  return cypher
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * 키워드 스캔이 식별자에 걸려 오탐하지 않도록 레이블·프로퍼티·파라미터를 지운다.
 * 예: `MATCH (n:Set) WHERE n.merge = 1` 은 쓰기 구문이 아니다.
 */
function maskIdentifiers(sanitized: string): string {
  return sanitized
    .replace(/`(?:[^`])*`/g, '``') // 백틱 식별자
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '$p') // 파라미터
    .replace(/\.\s*[A-Za-z_][A-Za-z0-9_]*/g, '.p') // 프로퍼티 접근
    .replace(/:\s*[A-Za-z_][A-Za-z0-9_]*/g, ':L'); // 레이블 / 관계 타입
}

function assertSingleStatement(sanitized: string): void {
  if (sanitized.replace(/;\s*$/, '').includes(';')) {
    throw new CypherValidationError(
      '한 번에 하나의 Cypher statement만 실행할 수 있다. 세미콜론으로 나뉜 쿼리를 각각 따로 호출해라.',
    );
  }
}

function assertNoWriteClause(masked: string): void {
  for (const keyword of WRITE_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(masked)) {
      throw new CypherValidationError(
        `이 tool은 읽기 전용이라 ${keyword} 구문을 실행할 수 없다. MATCH / OPTIONAL MATCH / WITH / RETURN 만으로 다시 작성해라.`,
      );
    }
  }
}

/** `CALL {` 은 subquery라 허용하고, `CALL some.proc(...)` 만 허용 목록과 대조한다. */
function assertAllowedProceduresOnly(sanitized: string): void {
  const callPattern = /\bCALL\s+(?!\{)([A-Za-z_][A-Za-z0-9_.]*)/gi;
  for (const match of sanitized.matchAll(callPattern)) {
    if (!ALLOWED_PROCEDURES.includes(match[1].toLowerCase())) {
      throw new CypherValidationError(
        `허용되지 않은 프로시저 호출이다: CALL ${match[1]}. 읽기 전용으로 허용된 프로시저는 ${ALLOWED_PROCEDURES.join(', ')} 뿐이다.`,
      );
    }
  }
}

/**
 * 결과 폭주를 막기 위해 LIMIT을 보장한다.
 *  - LIMIT이 없으면 끝에 붙인다
 *  - 리터럴 LIMIT이 상한보다 크면 상한으로 낮춘다
 *  - LIMIT이 리터럴이 아니면(`LIMIT $n`) 거부한다 — 상한을 강제할 수 없기 때문
 */
function enforceLimit(cypher: string, maxLimit: number): string {
  const query = cypher.replace(/;\s*$/, '').trimEnd();
  const trailingLimit = /\bLIMIT\s+(\S+)\s*$/i.exec(query);

  if (!trailingLimit) {
    return `${query} LIMIT ${maxLimit}`;
  }

  const literal = Number(trailingLimit[1]);
  if (!Number.isInteger(literal) || literal <= 0) {
    throw new CypherValidationError(
      `LIMIT에는 양의 정수 리터럴만 쓸 수 있다 (받은 값: ${trailingLimit[1]}). 예: LIMIT 50`,
    );
  }

  if (literal > maxLimit) {
    return query.replace(/\bLIMIT\s+\S+\s*$/i, `LIMIT ${maxLimit}`);
  }
  return query;
}

/**
 * 읽기 전용 검증을 통과한, LIMIT이 보장된 Cypher를 돌려준다.
 * 문제가 있으면 CypherValidationError를 던진다 — 호출부에서 isError 결과로 변환한다.
 */
export function validateReadOnlyCypher(cypher: string, maxLimit: number): string {
  const executable = stripComments(cypher).trim();
  if (!executable) {
    throw new CypherValidationError('실행할 Cypher가 비어 있다.');
  }

  const sanitized = stripLiterals(executable);
  assertSingleStatement(sanitized);
  assertNoWriteClause(maskIdentifiers(sanitized));
  assertAllowedProceduresOnly(sanitized);

  return enforceLimit(executable, maxLimit);
}
