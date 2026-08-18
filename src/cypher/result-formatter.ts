import {
  isDate,
  isDateTime,
  isDuration,
  isInt,
  isLocalDateTime,
  isLocalTime,
  isNode,
  isPath,
  isPoint,
  isRelationship,
  isTime,
  isUnboundRelationship,
  type Record as Neo4jRecord,
} from 'neo4j-driver';

/** 셀 하나가 길어지면 토큰만 먹고 읽히지 않는다. 넘치면 자른다. */
const MAX_CELL_LENGTH = 300;

function propertiesToJson(properties: Record<string, unknown>): string {
  const plain: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    plain[key] = isInt(value) ? toSafeNumber(value) : toDisplayValue(value);
  }
  return JSON.stringify(plain);
}

function toSafeNumber(value: { inSafeRange(): boolean; toNumber(): number; toString(): string }): number | string {
  return value.inSafeRange() ? value.toNumber() : value.toString();
}

/** Neo4j 값을 모델이 읽을 수 있는 문자열/원시값으로 바꾼다. */
function toDisplayValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (isInt(value)) return toSafeNumber(value);
  if (isNode(value)) return `(:${value.labels.join(':')} ${propertiesToJson(value.properties)})`;
  if (isRelationship(value) || isUnboundRelationship(value)) {
    return `[:${value.type} ${propertiesToJson(value.properties)}]`;
  }
  if (isPath(value)) {
    const hops = value.segments.map((s) => `-[:${s.relationship.type}]->(:${s.end.labels.join(':')})`).join('');
    return `(:${value.start.labels.join(':')})${hops}`;
  }
  if (
    isPoint(value) ||
    isDuration(value) ||
    isDate(value) ||
    isDateTime(value) ||
    isLocalDateTime(value) ||
    isTime(value) ||
    isLocalTime(value)
  ) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(toDisplayValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, toDisplayValue(v)]));
  }
  return value;
}

function toCell(value: unknown): string {
  const display = toDisplayValue(value);
  const text =
    display === null ? '' : typeof display === 'string' ? display : JSON.stringify(display);
  const flattened = text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
  return flattened.length > MAX_CELL_LENGTH ? `${flattened.slice(0, MAX_CELL_LENGTH)}…` : flattened;
}

/**
 * 열 이름과 행 값으로 markdown 표를 만든다.
 * raw JSON 덤프보다 토큰이 적게 들고 모델이 행/열 구조를 그대로 읽을 수 있다.
 *
 * Neo4j 결과든 평범한 객체 배열이든 이 함수를 거친다 — 표 모양을 한 곳에서만 정한다.
 */
export function formatRows(columns: string[], rows: unknown[][]): string {
  if (rows.length === 0) {
    return '결과 없음 (0 rows).';
  }

  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(toCell).join(' | ')} |`);

  return [header, divider, ...body, '', `${rows.length} rows`].join('\n');
}

/** Neo4j 쿼리 결과를 표로 만든다. 값 변환만 맡고 표 조립은 formatRows에 넘긴다. */
export function formatRecords(records: Neo4jRecord[]): string {
  if (records.length === 0) {
    return '결과 없음 (0 rows).';
  }

  const columns = records[0].keys.map(String);
  return formatRows(
    columns,
    records.map((record) => columns.map((column) => record.get(column))),
  );
}
