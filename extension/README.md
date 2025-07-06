# Firefox MCP Extension

This directory contains the Firefox WebExtension.

## Installation

1.  **Install the Native Messaging Host:**

    Run the `setup.sh` script in the `host` directory:

    ```bash
    cd ../host
    ./setup.sh
    ```

2.  **Install the WebExtension:**

    - Open Firefox and navigate to `about:debugging`.
    - Click "This Firefox" (or "This Nightly").
    - Click "Load Temporary Add-on".
    - Select the `manifest.json` file in this directory.

3.  **Enable in Private Windows:**

    - Go to `about:addons`.
    - Find the "Firefox MCP" extension.
    - Click the three dots and select "Manage".
    - Make sure "Run in Private Windows" is set to "Allow".

## Usage

Once the extension is installed and the native messaging host is running, you can use an MCP client like `gemini-cli` to open URLs in a private Firefox window.

**Example `gemini-cli` command:**

```bash
gemini-cli tool call browser.openUrl --tool-args '{"url": "https://www.google.com"}'
```
