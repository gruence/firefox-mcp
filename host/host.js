#!/usr/bin/env node
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { WebSocketServer } from 'ws';

// --- Native Messaging Protocol ---
class NativeMessagingTransform extends Transform {
  constructor() {
    super({ objectMode: true });
    this.buffer = Buffer.alloc(0);
    this.readingLength = true;
    this.messageLength = 0;
  }
  _transform(chunk, encoding, callback) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      if (this.readingLength) {
        if (this.buffer.length < 4) return callback();
        this.messageLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.slice(4);
        this.readingLength = false;
      }
      if (this.buffer.length < this.messageLength) return callback();
      const content = this.buffer.slice(0, this.messageLength);
      this.buffer = this.buffer.slice(this.messageLength);
      this.readingLength = true;
      this.push(JSON.parse(content.toString('utf8')));
    }
  }
}

const input = process.stdin.pipe(new NativeMessagingTransform());
const pendingRequests = new Map();
let requestId = 0;
let isExtensionConnected = true;

input.on('data', (response) => {
  const promise = pendingRequests.get(response.id);
  if (promise) {
    if (response.error) promise.reject(new Error(response.error.message));
    else promise.resolve(response.result);
    pendingRequests.delete(response.id);
  }
});

process.stdin.on('end', () => { isExtensionConnected = false; });

function sendToExtension(message) {
  return new Promise((resolve, reject) => {
    if (!isExtensionConnected) return reject(new Error('Extension not connected.'));
    const id = requestId++;
    pendingRequests.set(id, { resolve, reject });
    const json = JSON.stringify({ id, ...message });
    const header = Buffer.alloc(4);
    header.writeUInt32LE(json.length, 0);
    process.stdout.write(header);
    process.stdout.write(json);
  });
}

// --- MCP WebSocket Server ---
const mcpMethods = {
  'tools/list': () => ({
    tools: [{
      name: 'browser.openUrl',
      description: 'Opens a URL in a private Firefox window.',
      inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'The URL to open.' } }, required: ['url'] }
    }]
  }),

  'tools/call': async ({ params }) => {
    if (params.name !== 'browser.openUrl') {
      throw new Error(`Tool not found: ${params.name}`);
    }
    const { url } = params.arguments;
    try {
      return await sendToExtension({ action: 'openUrl', params: { url } });
    } catch (e) {
      // Fallback: launch Firefox if extension is not connected
      spawn('firefox', ['-private-window', url], { detached: true, stdio: 'ignore' });
      return { status: 'ok', launched: true, url };
    }
  }
};

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const request = JSON.parse(message.toString());
    const handler = mcpMethods[request.method];
    let response;

    if (!handler) {
      response = { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } };
    } else {
      try {
        const result = await handler(request);
        const finalResult = request.method === 'tools/call'
          ? { content: JSON.stringify(result) }
          : result;
        response = { jsonrpc: '2.0', id: request.id, result: finalResult };
      } catch (e) {
        response = { jsonrpc: '2.0', id: request.id, error: { code: -32602, message: e.message } };
      }
    }
    ws.send(JSON.stringify(response));
  });
});

console.error('MCP Host started. WebSocket server listening on port 8080.');