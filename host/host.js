#!/usr/bin/env node
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { createServer } from 'http';
import { createHash } from 'crypto';

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

function parseWebSocketFrame(buffer) {
  const firstByte = buffer.readUInt8(0);
  const opCode = firstByte & 0x0f;

  if (opCode === 8) { // Close frame
    return null;
  }
  if (opCode !== 1) { // We only support text frames
    return null;
  }

  const secondByte = buffer.readUInt8(1);
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let currentOffset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(currentOffset));
    currentOffset += 8;
  }

  let maskingKey;
  if (isMasked) {
    maskingKey = buffer.slice(currentOffset, currentOffset + 4);
    currentOffset += 4;
  }

  const payload = buffer.slice(currentOffset, currentOffset + payloadLength);
  if (isMasked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = payload[i] ^ maskingKey[i % 4];
    }
  }

  return payload.toString('utf8');
}

function sendWebSocketMessage(socket, message) {
  const messageBuffer = Buffer.from(message, 'utf8');
  const messageLength = messageBuffer.length;
  let header;

  if (messageLength <= 125) {
    header = Buffer.alloc(2);
    header.writeUInt8(messageLength, 1);
  } else if (messageLength <= 65535) {
    header = Buffer.alloc(4);
    header.writeUInt8(126, 1);
    header.writeUInt16BE(messageLength, 2);
  } else {
    header = Buffer.alloc(10);
    header.writeUInt8(127, 1);
    header.writeBigUInt64BE(BigInt(messageLength), 2);
  }

  header.writeUInt8(0b10000001, 0); // FIN bit + opcode for text
  socket.write(header);
  socket.write(messageBuffer);
}

const server = createServer((req, res) => {
  res.writeHead(400, { 'Content-Type': 'text/plain' });
  res.end('This is a WebSocket server.');
});

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  const hash = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${hash}\r\n` +
    '\r\n'
  );

  let messageBuffer = Buffer.alloc(0);

  socket.on('data', async (buffer) => {
    messageBuffer = Buffer.concat([messageBuffer, buffer]);
    const message = parseWebSocketFrame(messageBuffer);
    if (message) {
      messageBuffer = Buffer.alloc(0); // Clear buffer after processing
      const request = JSON.parse(message);
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
      sendWebSocketMessage(socket, JSON.stringify(response));
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
    socket.destroy();
  });

  socket.on('close', () => {
    // Handle client disconnection
  });
});

server.listen(8080, () => {
  console.error('MCP Host started. WebSocket server listening on port 8080.');
});