import { Body, Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';

import { McpServerFactory } from './mcp-server.factory';

/** stateless 모드라 세션 기반 SSE 스트림(GET)과 세션 종료(DELETE)는 지원하지 않는다. */
const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed. 이 서버는 stateless라 POST만 받는다.' },
  id: null,
};

@Controller('mcp')
export class McpController {
  constructor(private readonly factory: McpServerFactory) {}

  /**
   * 요청 하나마다 server와 transport를 새로 만들고 응답이 끝나면 버린다.
   * 세션 상태가 없으므로 인스턴스를 여러 대로 늘려도 그대로 동작한다.
   */
  @Post()
  async handleRequest(@Req() req: Request, @Res() res: Response, @Body() body: unknown): Promise<void> {
    const server = this.factory.create();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  @Get()
  rejectGet(@Res() res: Response): void {
    res.status(405).json(METHOD_NOT_ALLOWED);
  }

  @Delete()
  rejectDelete(@Res() res: Response): void {
    res.status(405).json(METHOD_NOT_ALLOWED);
  }
}
