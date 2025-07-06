# Firefox MCP: AI-Driven Private Browsing

This project enables AI assistants like `gemini-cli` to open URLs in a private Firefox window, providing a secure and private browsing experience.

## How it Works

The system consists of two main components:

1.  **Firefox WebExtension:** A browser extension that runs in Firefox and has permission to open private browsing windows and tabs.
2.  **Native Messaging Host:** A small Node.js script that acts as a bridge between the WebExtension and the AI assistant. It also functions as a Model Context Protocol (MCP) server.

Here's the workflow:

1.  You issue a command to your AI assistant (e.g., `gemini-cli`) to open a URL.
2.  The AI assistant, configured to use the local MCP server, sends a `tools/call` request to the Native Messaging Host.
3.  The Native Messaging Host receives the request and forwards it to the Firefox WebExtension via the Native Messaging API.
4.  The WebExtension receives the request and opens the URL in a new private tab or window.

## Architecture

```
+-----------------+      +-----------------------+      +----------------------+
|                 |      |                       |      |                      |
|  AI Assistant   |----->|  Native Messaging Host  |----->|  Firefox WebExtension  |
|  (gemini-cli)   |      |      (MCP Server)     |      |                      |
|                 |      |                       |      |                      |
+-----------------+      +-----------------------+      +----------------------+
```

-   **AI Assistant (`gemini-cli`):** The MCP client that initiates requests to open URLs.
-   **Native Messaging Host (`host.js`):**
    -   A Node.js script that runs as a separate process.
    -   Listens for MCP requests from the AI assistant on a WebSocket (port 8080).
    -   Communicates with the Firefox WebExtension using the Native Messaging protocol (standard input/output).
    -   Can launch Firefox in a private window if it's not already running.
-   **Firefox WebExtension (`background.js`):**
    -   A browser extension that runs within Firefox.
    -   Listens for messages from the Native Messaging Host.
    -   Uses the `windows` and `tabs` APIs to open URLs in a private context.

## Setup and Installation

1.  **Install the Native Messaging Host:**

    The `host` directory contains the Native Messaging Host. To install it, run the `setup.sh` script:

    ```bash
    cd host
    ./setup.sh
    ```

    This will:

    -   Make the `host.js` script executable.
    -   Create a native messaging host manifest file in the correct location for your operating system.

2.  **Install the WebExtension:**

    The `extension` directory contains the Firefox WebExtension.

    -   Open Firefox and navigate to `about:debugging`.
    -   Click "This Firefox" (or "This Nightly").
    -   Click "Load Temporary Add-on".
    -   Select the `manifest.json` file in the `extension` directory.

3.  **Enable in Private Windows:**

    -   Go to `about:addons`.
    -   Find the "Firefox MCP" extension.
    -   Click the three dots and select "Manage".
    -   Make sure "Run in Private Windows" is set to "Allow".

## Usage

Once the extension is installed and the native messaging host is running, you can use an MCP client like `gemini-cli` to open URLs in a private Firefox window.

**Example `gemini-cli` command:**

```bash
gemini-cli tool call browser.openUrl --tool-args '{"url": "https://www.google.com"}'
```

## Security

-   **User Consent:** The extension requires your explicit permission to run in private windows. This is a security measure to prevent extensions from accessing your private browsing data without your knowledge.
-   **Native Messaging:** The Native Messaging Host is a separate application that runs on your computer. It can only be accessed by the specific extension ID defined in its manifest file. This prevents other extensions or applications from communicating with it.
-   **Command Injection:** The Native Messaging Host launches Firefox using a command-line argument. The URL is passed as a separate argument, which prevents command injection vulnerabilities.
