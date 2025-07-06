# Firefox MCP (Model-Controller-Proxy)

This project enables programmatic control of the Firefox browser through a local WebSocket server, allowing you to send commands to open URLs, and potentially perform other browser actions, from any application that can communicate over WebSockets. It is designed to be a lightweight, dependency-free bridge between your local applications and your browser.

## Core Concepts

The project operates on a simple yet powerful architecture:

1.  **Host Application (`host/`)**: A Node.js application that runs a WebSocket server on `ws://localhost:8080`. This server is implemented *from scratch* using only built-in Node.js modules (`http`, `crypto`, `child_process`) to ensure it has no third-party dependencies. It listens for JSON-RPC 2.0 messages.

2.  **Browser Extension (`extension/`)**: A standard Firefox WebExtension that connects to the host application via Firefox's Native Messaging API. It acts as the agent inside the browser, receiving commands from the host and executing them using WebExtension APIs.

3.  **Communication Flow**:
    *   A client application (e.g., a script, another application) connects to the host's WebSocket server.
    *   The client sends a JSON-RPC command, like `tools/call` with a request to open a URL.
    *   The host application receives the WebSocket message, parses it, and translates it into a Native Messaging command.
    *   The command is sent to the Firefox extension.
    *   The extension executes the command (e.g., opens a URL in a new private window).
    *   A result or error is passed back through the same chain to the original WebSocket client.

## Features

-   **Zero Third-Party Dependencies**: The host application is written in pure Node.js, making it lightweight and secure.
-   **WebSocket Interface**: Provides a standard `ws://localhost:8080` endpoint for easy integration.
-   **Native Messaging**: Securely communicates with the Firefox extension.
-   **Fallback Mechanism**: If the browser extension is not connected or fails to respond, the host can fall back to launching a new Firefox process directly.
-   **Extensible**: The `mcpMethods` in `host.js` can be expanded to support more tools and browser actions.

## Setup Instructions

### 1. Host Application Setup

The host application requires Node.js. The `setup.sh` script will create a native messaging manifest file and make the host script executable.

```bash
# Navigate to the host directory
cd host

# Run the setup script
# This will create the necessary manifest for Firefox to find the host
./setup.sh
```

After setup, you can start the host manually to test it:

```bash
# Run the host server
node host.js
```

You should see the message: `MCP Host: WebSocket server listening on port 8080.`

### 2. Browser Extension Installation

1.  Open Firefox and navigate to the `about:debugging` page.
2.  In the left-hand menu, click on **"This Firefox"**.
3.  Click the **"Load Temporary Add-on..."** button.
4.  Navigate to the `extension/` directory of this project and select the `manifest.json` file.

The extension icon should appear in your Firefox toolbar. The extension will automatically try to connect to the native host application.

## How to Use

You can interact with the host application using any WebSocket client. The communication protocol is JSON-RPC 2.0.

### Example: Opening a URL

To open a URL in a new private Firefox window, send the following JSON payload to `ws://localhost:8080`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser.openUrl",
    "arguments": {
      "url": "https://www.mozilla.org"
    }
  }
}
```

### Example: Listing Available Tools

To discover what tools are available, use the `tools/list` method:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

The server will respond with a list of available tools and their schemas.

## Project Structure

```
/var/www/firefox-mcp/
├───.gitignore
├───README.md         # This file
├───RESEARCH.md       # Research notes
├───extension/
│   ├───background.js # Extension logic, connects to host
│   └───manifest.json   # Extension manifest
└───host/
    ├───host.js         # The core Node.js WebSocket server and native messaging host
    ├───manifest.json   # Native messaging host manifest (template)
    ├───package.json    # Node.js project file (no dependencies)
    └───setup.sh        # Host setup script
```
