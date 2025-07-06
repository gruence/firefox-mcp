#!/usr/bin/env node
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { createServer } from 'http';
import { createHash } from 'crypto';

// --- Native Messaging Protocol Implementation ---
// This part of the script handles communication with the Firefox web extension
// using the standard Native Messaging protocol. It allows the host process
// to exchange JSON messages with the extension.

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
        if (this.buffer.length < 4) return callback(); // Not enough data for length
        this.messageLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.slice(4);
        this.readingLength = false;
      }
      if (this.buffer.length < this.messageLength) return callback(); // Not enough data for message
      const content = this.buffer.slice(0, this.messageLength);
      this.buffer = this.buffer.slice(this.messageLength);
      this.readingLength = true;
      try {
        this.push(JSON.parse(content.toString('utf8')));
      } catch (e) {
        // Ignore invalid JSON from extension
      }
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

process.stdin.on('end', () => {
  isExtensionConnected = false;
  // Reject all pending requests when extension disconnects
  for (const [id, promise] of pendingRequests.entries()) {
    promise.reject(new Error('Extension disconnected.'));
    pendingRequests.delete(id);
  }
});

function sendToExtension(message) {
  return new Promise((resolve, reject) => {
    if (!isExtensionConnected) return reject(new Error('Extension not connected.'));
    const id = requestId++;
    // Timeout for requests to the extension
    const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error('Request to extension timed out.'));
    }, 5000); // 5 second timeout

    pendingRequests.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
    });

    const json = JSON.stringify({ id, ...message });
    const header = Buffer.alloc(4);
    header.writeUInt32LE(json.length, 0);
    process.stdout.write(header);
    process.stdout.write(json);
  });
}

// --- MCP WebSocket Server Implementation ---
// This is a from-scratch WebSocket server implementation using only built-in Node.js modules.
// It handles the WebSocket handshake and message framing as per RFC 6455.
// This avoids the need for external libraries like 'ws'.

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
      // Try to use the extension first
      return await sendToExtension({ action: 'openUrl', params: { url } });
    } catch (e) {
      // Fallback: if extension is not available, launch Firefox directly.
      // This is useful for testing the host without the extension.
      spawn('firefox', ['-private-window', url], { detached: true, stdio: 'ignore' });
      return { status: 'ok', launched: true, url, note: 'Launched Firefox directly as extension was not available.' };
    }
  }
};

function createWebSocketResponseKey(key) {
  const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return createHash('sha1').update(key + magicString).digest('base64');
}

function sendWebSocketFrame(socket, data, options = {}) {
  const { opCode = 1, fin = true } = options; // Default to text frame
  const payload = Buffer.from(data);
  const payloadLen = payload.length;

  let header;
  let payloadOffset = 2;
  if (payloadLen <= 125) {
    header = Buffer.alloc(2);
    header.writeUInt8(payloadLen, 1);
  } else if (payloadLen <= 65535) {
    header = Buffer.alloc(4);
    header.writeUInt8(126, 1);
    header.writeUInt16BE(payloadLen, 2);
    payloadOffset = 4;
  } else {
    header = Buffer.alloc(10);
    header.writeUInt8(127, 1);
    header.writeBigUInt64BE(BigInt(payloadLen), 2);
    payloadOffset = 10;
  }

  header.writeUInt8((fin ? 0x80 : 0) | opCode, 0);
  socket.write(header);
  socket.write(payload);
}

function handleWebSocketConnection(socket) {
  let frameBuffer = Buffer.alloc(0);
  let messagePayload = Buffer.alloc(0);
  let messageOpCode = null;

  socket.on('data', (chunk) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);

    while (frameBuffer.length >= 2) {
      const firstByte = frameBuffer.readUInt8(0);
      const fin = (firstByte & 0x80) !== 0;
      const opCode = firstByte & 0x0f;

      const secondByte = frameBuffer.readUInt8(1);
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (frameBuffer.length < 4) break;
        payloadLen = frameBuffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (frameBuffer.length < 10) break;
        payloadLen = Number(frameBuffer.readBigUInt64BE(2));
        offset = 10;
      }

      if (!isMasked) { // As per RFC, client frames must be masked
        socket.destroy();
        return;
      }

      const maskKeyOffset = offset;
      offset += 4;
      const payloadOffset = offset;
      const frameLen = payloadOffset + payloadLen;

      if (frameBuffer.length < frameLen) break; // Incomplete frame

      const maskKey = frameBuffer.slice(maskKeyOffset, maskKeyOffset + 4);
      const payload = frameBuffer.slice(payloadOffset, frameLen);

      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i % 4];
      }

      frameBuffer = frameBuffer.slice(frameLen);

      if (opCode === 8) { // Close
        socket.end();
        return;
      }

      if (opCode >= 1 && opCode <= 2) { // Text or Binary frame
          messagePayload = payload;
          messageOpCode = opCode;
      } else if (opCode === 0) { // Continuation frame
          messagePayload = Buffer.concat([messagePayload, payload]);
      }


      if (fin) {
        if (messageOpCode === 1) { // Text frame
          processWebSocketMessage(socket, messagePayload.toString('utf8'));
        }
        messagePayload = Buffer.alloc(0);
        messageOpCode = null;
      }
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
    socket.destroy();
  });
}

async function processWebSocketMessage(socket, message) {
    let request;
    try {
        request = JSON.parse(message);
    } catch (e) {
        const errorResponse = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
        sendWebSocketFrame(socket, JSON.stringify(errorResponse));
        return;
    }

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
    sendWebSocketFrame(socket, JSON.stringify(response));
}


const server = createServer((req, res) => {
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed. This is a WebSocket server.');
});

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'].toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  const acceptKey = createWebSocketResponseKey(key);

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    '\r\n'
  );

  handleWebSocketConnection(socket);
});

const port = 8080;
server.listen(port, () => {
  // Note: console.log/error goes to the browser console when launched by Firefox
  // so this is useful for debugging.
  console.error(`MCP Host: WebSocket server listening on port ${port}.`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Is another instance of the host running?`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});