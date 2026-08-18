/**
 * 실행 중인 MCP 서버에 붙어 tool을 차례로 호출해보는 스크립트.
 *
 * 사용법: node scripts/probe.mjs [url]   (기본 http://localhost:3000/mcp)
 *
 * unit test가 못 잡는 걸 잡는다 — tool이 실제로 노출되는지, inputSchema가 의도대로
 * 생성됐는지, transport를 통과한 결과가 어떤 텍스트로 모델에게 도착하는지.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'http://localhost:3000/mcp';

const CALLS = [
  ['get_building_structure', {}],
  ['get_building_structure', { buildingName: '성수' }],
  ['search_spaces', { purpose: '팝업존', minCapacity: 100 }],
  ['search_spaces', { keyword: '메인홀' }],
  ['get_space', { spaceId: 'B1-1F-101' }],
  // 예시 질문: "과거에 무신사 팝업 한 공간 알려줘"
  ['search_events', { brandName: '무신사', type: '팝업', period: '과거' }],
  ['search_events', { brandName: '무신사' }],
  ['search_events', { period: '진행중' }],
  ['search_events', { spaceId: 'B1-1F-101' }],
  // 아래 둘은 isError: true가 나와야 정상이다
  ['get_space', { spaceId: 'B9-9F-999' }],
  ['get_building_structure', { buildingName: '없는건물' }],
];

const client = new Client({ name: 'mcp-chat-probe', version: '0.1.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const { tools } = await client.listTools();
console.log(`연결됨: ${url}`);
console.log(`tool ${tools.length}개 — ${tools.map((t) => t.name).join(', ')}\n`);

for (const [name, args] of CALLS) {
  const result = await client.callTool({ name, arguments: args });
  const mark = result.isError ? '✘' : '✔';

  console.log(`${mark} ${name} ${JSON.stringify(args)}`);
  console.log(
    result.content
      .map((c) => c.text ?? `[${c.type}]`)
      .join('\n')
      .replace(/^/gm, '    '),
  );
  console.log();
}

await client.close();
