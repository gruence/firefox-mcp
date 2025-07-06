# A Firefox Debug Extension for AI-Driven Private Browsing via Model Context Protocol

## Executive Summary

This report outlines the architecture and implementation considerations for a Firefox debug extension designed to facilitate secure, private browsing interactions driven by AI assistants like `gemini-cli` via the Model Context Protocol (MCP). The solution leverages Firefox's WebExtensions API for browser control, Native Messaging for inter-process communication with a local MCP server, and command-line arguments for launching Firefox in Private Browsing mode. Key aspects include managing user consent for private data access, ensuring robust security in native code execution, and establishing a multi-layered debugging strategy.

## 1. Introduction: A Firefox Debug Extension for AI-Driven Private Browsing

The proliferation of AI assistants and agents necessitates robust mechanisms for them to interact with external systems, including web browsers. This report addresses the challenge of enabling an AI assistant, specifically `gemini-cli`, to programmatically open URLs within Firefox's Private Browsing mode, ensuring user privacy and control. The proposed solution involves developing a Firefox WebExtension that acts as a bridge, communicating with `gemini-cli` through a local Model Context Protocol (MCP) server implemented as a Native Messaging host. This architecture allows for a secure, debuggable, and extensible integration, providing AI agents with a controlled gateway to private web browsing.

The design of such an integration is inherently complex due to the security sandboxing of browser extensions and the need for inter-process communication with local applications. WebExtensions operate within a restricted environment, preventing direct execution of system commands or arbitrary local applications. This fundamental limitation necessitates an intermediary component to bridge the browser's capabilities with external AI agents. Native Messaging provides the only standard WebExtension API for secure, bidirectional communication with a local application. This local application, serving as the Native Messaging Host, gains the necessary system-level privileges to launch Firefox or interact with `gemini-cli`, which operates as a local AI agent. Consequently, a three-tier architecture—comprising the Firefox Extension, a Native Messaging Host, and the AI Assistant—emerges as a foundational requirement dictated by browser security models and the nature of the task.

While Native Messaging enables crucial functionality, it introduces a significant security consideration. The native application, by its very nature, possesses direct access to the user's computer. This implies that a compromised or malicious native host could potentially execute arbitrary code or access sensitive data. Browser vendors attempt to mitigate this by requiring explicit permission declarations, such as `allowed_extensions` in the native manifest , and by mandating explicit user permission for the extension to operate in private browsing contexts. However, the ultimate responsibility for trust rests with the user who installs the native application. This underscores the critical importance of meticulous security review for the Native Messaging Host component, particularly for a "debug extension" that might be utilized by developers often operating with elevated system privileges.

## 2. Firefox WebExtension Fundamentals for Debugging

Developing a Firefox WebExtension requires understanding its core components and the debugging tools available. The extension will primarily consist of a `manifest.json` file defining its properties and permissions, and background scripts that handle events and communicate with other components.

### 2.1. Core WebExtension Components

The foundation of any Firefox WebExtension is its `manifest.json` file. This JSON-formatted document serves as the blueprint, declaring essential metadata such as the extension's name, version, and, critically, the permissions it requires to function within the browser environment. For this specific debug extension, permissions like `nativeMessaging` will be indispensable for establishing communication with the local AI bridge, while `tabs` and `windows` permissions are vital for managing browser tabs and windows, particularly in the context of private browsing.

Central to the extension's operational logic are its background scripts. These scripts operate persistently in the background throughout the extension's lifecycle, acting as event listeners and managing the overall state and coordination of the extension. Their role is paramount in maintaining the connection with the Native Messaging host and orchestrating browser actions such as opening URLs. Background scripts can be configured as either persistent or non-persistent, with persistent scripts remaining loaded for the entire duration of the extension's activity. While content scripts, which interact directly with web page content, are not central to the core URL opening mechanism, they could be leveraged for more granular in-page control if future AI assistant requirements extended beyond simple navigation. The interaction between these components is driven by event listeners, which enable background scripts to react to various browser events, including user interactions with the browser action icon or messages received from other parts of the extension.

### 2.2. Debugging WebExtensions

Firefox provides a robust and comprehensive suite of developer tools specifically designed for debugging WebExtensions. The `about:debugging` page serves as the central interface for managing and inspecting all installed extensions. To initiate debugging for a specific extension, developers can navigate to `about:debugging`, select "This Firefox" (or "This Nightly" for Nightly builds), and then click the "Inspect" button adjacent to their extension's entry. This action launches the Toolbox, a dedicated developer console that provides access to the Inspector for examining HTML and CSS, the Console for viewing log outputs and errors, and the Debugger for setting breakpoints and stepping through JavaScript code.

The Console within the Toolbox is particularly useful, as it displays messages originating from background scripts and other extension pages, including any output generated by `console.log()` statements and errors raised by the browser during execution. For a more efficient debugging workflow, utilizing the split console view is highly recommended, allowing developers to simultaneously monitor Console output while stepping through code in the Debugger. Firefox also offers specialized debugging contexts tailored to different components of an extension, such as background scripts, options pages, and popups. Content scripts, which execute within the context of a web page, are debugged directly using the developer tools associated with the specific tab where they are running.

The extensive and granular debugging tools available in Firefox, such as `about:debugging`, the split console, and specialized debuggers for various script types, indicate that the WebExtension platform is engineered to support complex, multi-component applications. This suggests that while the development of such an intricate system may present challenges, the necessary diagnostic capabilities are readily available to identify and resolve issues across the extension's operational lifecycle. The very nature of a "debug extension" implies a requirement for robust internal diagnostics, and the presence of these advanced tools, while demanding developer proficiency, inherently facilitates the creation of a sophisticated, interconnected system like the one proposed, where problems can manifest at multiple architectural layers.

## 3. Private Browsing Mode: Control and Permissions

Firefox's Private Browsing mode, often colloquially referred to as "incognito mode," is a cornerstone feature for user privacy. Its fundamental design ensures that no browsing history, cookies, or temporary internet files are retained once the private session concludes. Integrating an AI assistant with this mode necessitates meticulous handling of browser permissions and programmatic control over private window and tab creation.

### 3.1. Understanding Private Browsing Behavior

When a new Private Browsing window is initiated, Firefox establishes an isolated browsing environment. This isolation ensures that any data generated during the session, such as visited sites, form entries, cookies, and cached content, is automatically cleared upon the window's closure. This ephemeral data handling is central to fulfilling user expectations regarding privacy. Users can manually activate Private Browsing windows through the standard Firefox menu or via convenient keyboard shortcuts, typically `Ctrl` + `Shift` + `P` on Windows or `Cmd` + `Shift` + `P` on macOS.

### 3.2. WebExtension Permissions for Private Mode

A critical security and privacy measure in Firefox's WebExtension model is that extensions are, by default, not permitted to operate within Private Browsing windows. This default restriction is designed to prevent extensions from inadvertently accessing or logging potentially sensitive data generated during private sessions. To enable an extension to function in Private Browsing, the user is required to provide explicit consent. This authorization can be granted either during the initial installation process, where a prompt may appear, or at a later time by navigating to the Firefox Add-ons Manager and manually enabling the "Run in Private Windows" option for the specific extension.

Internally, Firefox manages this user-granted permission through a hidden extension permission known as `internal:privateBrowsingAllowed`. It is important to note that this permission is automatically reset if the extension is disabled or uninstalled. Furthermore, a notable policy change by Mozilla involved the deliberate removal of the `about:config` preference `extensions.allowPrivateBrowsingByDefault`. This preference previously allowed all extensions to run in private browsing by default but was deprecated to reinforce Firefox's strong user-centric privacy stance, emphasizing explicit, per-extension control. Beyond private browsing specific permissions, the general `tabs` API permission is typically required to access sensitive properties of a tab, such as its `url`, `title`, and `favIconUrl`, and in Firefox, it is also necessary to perform queries based on a URL. This permission is generally sufficient for the creation or modification of tabs and windows.

The architectural evolution, exemplified by the discontinuation of `extensions.allowPrivateBrowsingByDefault` , underscores a fundamental shift towards enhanced user privacy and control within Firefox's WebExtension ecosystem. This design philosophy mandates that the extension's operational efficacy in private browsing environments is contingent upon explicit user authorization. Consequently, the extension's installation and initial setup process must incorporate clear instructions or a guided flow to prompt the user to grant this specific permission. Failure to do so would result in the core functionality being silently disabled or encountering permission-related errors, thereby impacting user experience and trust.

### 3.3. Programmatic Control of Private Windows and Tabs

The Firefox WebExtensions API provides robust mechanisms for programmatic control over browser windows and tabs, which are essential for managing private browsing sessions.

- **Creating New Private Windows:** The `windows.create()` API offers the capability to open a new browser window. By setting the `incognito` property within the `createProperties` object to `true`, the newly created window will automatically be a Private Browsing window. This function is critical for fulfilling the requirement to launch Firefox directly into private mode if no instance is currently running. For instance, a call such as `browser.windows.create({ url: "https://example.com", incognito: true });` would achieve this.

- **Creating New Private Tabs:** The `tabs.create()` API facilitates the creation of new tabs. If the `windowId` parameter supplied to this function refers to an already existing private window, the new tab will seamlessly open within that private context. The `Tab` object, which can be retrieved through functions like `tabs.query()`, includes an `incognito` boolean property that precisely indicates whether a given tab resides within a private browsing window.

- **Detecting Existing Private Windows/Tabs:** To determine if Firefox is already running and if any private browsing windows are currently open, the `tabs.query()` API can be utilized. By querying for tabs with the `incognito` property set to `true`, the extension can identify existing private browsing contexts. This capability is vital for implementing the logic that prioritizes opening a new tab in an existing private instance if available, before resorting to launching a new browser window.

### 3.4. Launching Firefox in Private Browsing from Command Line

To address the scenario where Firefox is not currently running, the Native Messaging Host (discussed in Section 5) will assume the responsibility of launching the browser. Firefox provides a dedicated command-line switch, `-private-window`, which instructs the browser to start directly in Private Browsing mode. This command-line capability is crucial for ensuring that AI-initiated URLs are always opened in a private context, even from a cold start. An example command would be `firefox -private-window https://example.com`.

The combined capabilities of programmatically creating private windows via `windows.create({incognito: true})` , creating new tabs within an existing private window context using `tabs.create()` , and the ability to launch Firefox directly into private browsing mode via the `firefox -private-window` command-line argument offer comprehensive control over private browsing sessions. This layered approach enables a robust implementation that can adapt dynamically: if Firefox is not running, the Native Messaging Host can initiate a private session via the command line; if Firefox is running but no private window is open, the extension can create a new private window; and if a private window already exists, a new tab can be opened within it. This adaptability ensures that the requirements for utilizing an existing Firefox installation and opening new tabs in Private Browsing mode are met effectively.

### 3.5. Valuable Table: Firefox WebExtension Permissions for Private Browsing

The following table outlines the essential Firefox WebExtension permissions required for managing private browsing sessions and interacting with a native application. Understanding these permissions is fundamental to the extension's functionality and its interaction with user privacy settings.

| Permission | Type | Description | Necessity for Private Browsing / Native Messaging |
| :--- | :--- | :--- | :--- |
| `tabs` | API | Grants access to sensitive properties of Tab objects (e.g., url, title) and enables querying tabs by URL. | Essential for detecting existing private tabs/windows and creating new tabs within specific windows. |
| `windows` | API | Allows the extension to create, query, and manage browser windows. | Crucial for creating new private browsing windows (`incognito: true`) and identifying existing windows. |
| `nativeMessaging` | API | Enables communication between the WebExtension and a native application installed on the user's computer. | Absolutely required for the extension to communicate with the Native Messaging Host, which acts as the MCP server and launches Firefox. |
| `internal:privateBrowsingAllowed` | Hidden | An internal permission that indicates whether the user has explicitly allowed the extension to run in Private Browsing windows. | Mandatory for the extension to operate within private browsing contexts. This permission is granted by the user via the Add-ons Manager. |

This table is critical because permissions serve as the gatekeepers for browser extension capabilities. Explicitly detailing and explaining each permission provides immediate clarity on the specific functionalities the extension requires. More importantly, it highlights the permissions that the user must explicitly grant for the core features to operate, particularly the `internal:privateBrowsingAllowed` permission, which is a direct reflection of Firefox's privacy-by-design philosophy. Without these permissions, the fundamental objectives of the query cannot be achieved.

## 4. Model Context Protocol (MCP): The AI Communication Backbone

The Model Context Protocol (MCP) is an open standard designed to facilitate the seamless integration of Large Language Model (LLM) applications with external data sources and tools. This protocol is central to enabling AI assistants to interact with the Firefox debug extension.

### 4.1. MCP's Role and Architecture

MCP provides a standardized approach for applications to share contextual information with LLMs, expose various tools and capabilities to AI systems, and build composable integrations and workflows. It draws inspiration from established protocols like the Language Server Protocol, aiming to standardize the integration of context and tools within the broader AI application ecosystem.

At its core, MCP operates on a client-server architecture, defining three primary components for communication:

- **Hosts:** These are the LLM applications that initiate connections and act as orchestrators. In the context of this project, `gemini-cli` functions as an MCP Host, initiating requests to external services.
- **Clients:** These are connectors embedded within the Host application. `gemini-cli` contains an MCP client component that interacts with MCP servers.
- **Servers:** These services provide context and capabilities to the Hosts/Clients. For this solution, the Native Messaging Host will function as an MCP Server, exposing browser control functionalities to `gemini-cli`.

### 4.2. Communication Mechanism: JSON-RPC 2.0

MCP utilizes JSON-RPC 2.0 messages as its communication layer, enabling structured interactions between hosts, clients, and servers. This lightweight, text-based format defines remote procedure calls (RPCs) for various tasks, including tool invocation. Communication can occur over `stdio` (standard input/output) or WebSockets. For integration with Firefox's Native Messaging, `stdio` is the standard and most direct transport mechanism.

MCP's reliance on JSON-RPC 2.0 over `stdio` presents a significant architectural alignment with Firefox's Native Messaging API, which also leverages `stdin/stdout` for inter-process communication. This direct correspondence in communication channels simplifies the design of the bridge between the Firefox WebExtension and the AI assistant, as the Native Messaging Host can directly implement the MCP server logic without requiring an additional translation layer for data transport. This inherent compatibility streamlines the overall system architecture.

### 4.3. MCP "Tools": Definition, Discovery, and Invocation

A fundamental concept within MCP is "Tools," which are callable functions that MCP servers expose to clients. These tools enable AI models to interact with real-world external environments, such as querying databases, calling APIs, or, in this case, controlling browser behavior.

Each tool is uniquely identified by a name and includes metadata describing its schema. A tool definition typically comprises:

- `name`: A unique identifier for the tool.
- `description`: A human-readable explanation of the tool's functionality.
- `inputSchema`: A JSON Schema defining the expected parameters for the tool.
- `annotations`: Optional properties describing the tool's behavior, such as `readOnlyHint` or `destructiveHint`.

MCP clients, such as `gemini-cli`, can dynamically discover available tools by sending `tools/list` requests to an MCP server. Once a tool is discovered, clients can invoke it by sending `tools/call` requests, providing the tool's name and the necessary arguments. For instance, an AI assistant might send a JSON-RPC request like `{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "New York"}}}` to invoke a weather tool.

The "Tools" concept within MCP provides the direct mechanism through which the AI assistant will request URL openings. This structural definition implies that the Native Messaging Host must implement an MCP tool, for example, named `browser.openPrivateUrl`, complete with a formally defined `inputSchema` for the URL parameter and potentially an `outputSchema` for success or failure responses. This approach transforms a simple message-passing requirement into a structured, callable function, significantly enhancing the robustness and discoverability of the interaction for the AI agent.

MCP's use of JSON Schema for defining tool `inputSchema` is a powerful design choice. This provides a machine-readable contract for the tool's parameters, enabling the `gemini-cli` to understand precisely what arguments a tool expects and their respective data types. This capability is crucial for the AI agent's "reason and act" loop to correctly formulate tool calls, ensuring that requests are well-formed and valid. Furthermore, the JSON Schema facilitates rigorous validation of incoming `tools/call` arguments by the MCP server (our Native Messaging Host), which is vital for preventing malformed requests and mitigating potential security vulnerabilities such as command injection. This structured approach significantly enhances the reliability, interoperability, and security of the AI-tool interaction.

### 4.4. Security and Trust Considerations in MCP

Given that MCP enables powerful capabilities through arbitrary data access and code execution, implementers must carefully address significant security and trust considerations. Key principles include:

- **User Consent and Control:** Users must explicitly consent to and understand all data access and operations, retaining control over data sharing and actions taken. Implementers should provide clear user interfaces for reviewing and authorizing activities.
- **Data Privacy:** Hosts must obtain explicit user consent before exposing user data to servers and must not transmit resource data elsewhere without user consent. User data should be protected with appropriate access controls.
- **Tool Safety:** Tools represent arbitrary code execution and must be treated with appropriate caution. Descriptions of tool behavior, such as annotations, should be considered untrusted unless they originate from a trusted server. Hosts must obtain explicit user consent before invoking any tool, and users should understand what each tool does before authorizing its use.

The emphasis on user consent for data access and tool invocation within MCP directly converges with Firefox's explicit user permission requirement for extensions operating in private browsing mode. This convergence establishes a dual-layer consent requirement: first, the user must grant the Firefox extension permission to run in private mode, and second, the extension (or its Native Messaging Host component acting as an MCP server) must obtain explicit confirmation from the user before executing sensitive "tools" such as opening URLs or launching applications. This multi-layered consent mechanism is paramount for maintaining user trust and adhering to privacy best practices.

### 4.5. Valuable Table: Key MCP JSON-RPC Message Examples

The following table illustrates typical JSON-RPC 2.0 messages used in the Model Context Protocol, demonstrating how `gemini-cli` (as an MCP Client) would interact with the Native Messaging Host (as an MCP Server) to discover and invoke browser-related tools. These examples adhere to the protocol's structure for method calls, parameters, and responses.

| Message Type | Direction | Example JSON Payload | Description |
| :--- | :--- | :--- | :--- |
| `tools/list` Request | `gemini-cli` -> NM Host | ```json
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
``` | A request from the AI assistant to discover all available tools exposed by the MCP server. |
| `tools/list` Response | NM Host -> `gemini-cli` | ```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "openUrlInPrivateBrowser",
        "description": "Opens a given URL in a new private browsing tab or window.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "description": "The fully qualified URL to open."
            }
          },
          "required": ["url"]
        },
        "annotations": {"destructiveHint": false, "readOnlyHint": false, "openWorldHint": true}
      }
    ]
  }
}
``` | The server's response, listing available tools. Here, an `openUrlInPrivateBrowser` tool is advertised with its schema. |
| `tools/call` Request | `gemini-cli` -> NM Host | ```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "openUrlInPrivateBrowser", "arguments": {"url": "https://example.com/sensitive-data"}}}
``` | The AI assistant invokes the `openUrlInPrivateBrowser` tool, providing the URL as an argument. |
| `tools/call` Success Response | NM Host -> `gemini-cli` | ```json
{"jsonrpc": "2.0", "id": 2, "result": {"content": "URL opened successfully."}}
``` | The server confirms successful execution of the tool. |
| `tools/call` Error Response | NM Host -> `gemini-cli` | ```json
{"jsonrpc": "2.0", "id": 2, "error": {"code": -32602, "message": "Invalid parameters: URL is missing or malformed."}}
``` | The server reports an error, adhering to JSON-RPC error format. |

This table is invaluable because MCP's functionality is entirely predicated on structured JSON-RPC messages. Providing concrete examples of `tools/list` (demonstrating how the AI discovers available capabilities) and `tools/call` (illustrating how the AI requests specific actions) directly addresses the core requirement of communication via MCP. The inclusion of the `inputSchema` within the `tools/list` response is particularly important, as it formally defines the parameters expected by the tool , which is critical for the AI agent to accurately understand and utilize the tool. Presenting both success and error responses further clarifies the expected communication flow and is highly beneficial for debugging the MCP server component. This table effectively serves as a mini-specification for the interaction between `gemini-cli` and the Native Messaging Host/MCP Server.

## 5. Native Messaging: Bridging Firefox Extension and MCP Server

Native Messaging serves as the crucial inter-process communication layer that bridges the sandboxed Firefox WebExtension with a local application, which in this architecture also functions as the MCP server. This mechanism is indispensable because WebExtensions are inherently restricted from directly executing system commands or arbitrary local applications.

### 5.1. Native Messaging Architecture

The Native Messaging system comprises three primary components:

- **Firefox WebExtension:** This is the browser-side component that initiates communication requests to the native application.
- **Host Manifest (App Manifest):** A JSON file installed on the user's operating system. This manifest acts as a configuration file, describing how the browser can connect to the native application. It specifies the native application's name, the path to its executable, the communication type (which must be `stdio`), and a crucial `allowed_extensions` field listing the IDs of extensions permitted to communicate with it.
- **Native Application (Native Messaging Host):** This is the executable program (e.g., a Python script or Node.js script) that runs on the user's local machine. It communicates with the Firefox extension by reading messages from its standard input (`stdin`) and writing responses to its standard output (`stdout`).

### 5.2. Developing the Native Messaging Host

The Native Messaging Host is the linchpin of this integration, serving a dual role as both the Native Messaging endpoint for the Firefox extension and the MCP server for `gemini-cli`.

- **Language Choice:** Common choices for implementing Native Messaging Hosts include Python and Node.js, largely due to their robust capabilities for handling standard input/output (`stdio`) and parsing/generating JSON messages.
- **Handling `stdin/stdout` for JSON-RPC messages:** The communication protocol for Native Messaging dictates that each message is a serialized JSON object, UTF-8 encoded, and preceded by a 32-bit unsigned integer that specifies the message length in native byte order. This low-level protocol requires careful implementation to ensure correct message framing and parsing.
- **Executing System Commands:** A primary function of the Native Messaging Host is to execute system-level commands, particularly for launching Firefox in private mode. This is achieved using process management modules: Python's `subprocess` module (e.g., `subprocess.run()`) or Node.js's `child_process` module (e.g., `child_process.spawn()` or `child_process.exec()`). The specific command to launch Firefox in private mode is `firefox -private-window <URL>`.

The Native Messaging Host must operate as a persistent process, typically by utilizing `runtime.connectNative()` from the Firefox extension side. This is a critical architectural decision because MCP defines a client-server architecture that supports stateful connections. If the native application is to function as a long-lived MCP server, capable of handling multiple requests from `gemini-cli` over time, it must remain running. In contrast, `runtime.sendNativeMessage()` launches a new instance of the native application for each message and terminates it after a reply , which is inefficient and unsuitable for a persistent MCP server. Therefore, `runtime.connectNative()` is the appropriate choice for managing the lifecycle of the Native Messaging Host in this context.

Executing the `firefox -private-window` command from the Native Messaging Host introduces critical considerations regarding system paths and executable permissions. This aspect of the implementation is highly platform-dependent, requiring distinct approaches for Windows (which might involve using a `.bat` file to invoke Python scripts ) versus direct execution on Linux or macOS. Such platform-specific nuances necessitate careful handling of environment variables, executable permissions, and path configurations to avoid common issues like "File at path does not exist, or is not executable". Furthermore, if the URL provided by the AI assistant is directly embedded into the shell command without proper sanitization, it creates a significant command injection vulnerability. Robust input validation and secure command execution practices are paramount to mitigate these risks.

### 5.3. Configuring the Native Messaging Host Manifest

The Native Messaging Host manifest is a JSON file that must be correctly configured and placed in a platform-specific location for Firefox to discover and connect to the native application. Key properties within this manifest include:

- `name`: This string must precisely match the name used by the extension when calling `runtime.connectNative()` or `runtime.sendNativeMessage()`.
- `path`: This specifies the absolute path to the native application's executable. On Windows, it is possible to use a relative path or a `.bat` file to launch scripts.
- `type`: For standard input/output communication, this value must be `"stdio"`.
- `allowed_extensions`: This is an array of strings, where each string is the unique ID of a Firefox extension permitted to communicate with this native application. To ensure this works during development, the Firefox extension's `manifest.json` should explicitly define its ID using the `browser_specific_settings.gecko.id` key.

The manifest file's location is critical and varies by operating system. On Linux and macOS, it is typically placed in specific directories, while on Windows, a registry key must be created that points to the manifest's location.

### 5.4. Communication Flow: Extension to Native Host

The Firefox extension communicates with the Native Messaging Host using the `runtime.connectNative()` API. This establishes a persistent port for bidirectional message exchange. The extension will send internal JSON messages to the Native Messaging Host, instructing it to perform browser actions (e.g., "open URL in private tab"). The Native Messaging Host, in turn, will process these messages, execute the requested actions (including launching Firefox if necessary), and send back responses to the extension via the same port.

### 5.5. Valuable Table: Native Messaging Host Manifest Structure

The Native Messaging Host Manifest is a critical configuration file that enables Firefox to locate and communicate with the external application. Its precise structure and placement are essential for the functionality of the debug extension.

| Field Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `name` | String | A unique identifier for the native application. This must match the name used by the Firefox extension when calling `runtime.connectNative()`.
| `"firefox_mcp_host"` |
| `description` | String | A human-readable description of the native application. | `"Firefox MCP Host for AI Assistant Integration"` |
| `path` | String | The absolute path to the native application's executable. On Windows, a relative path or a batch file (`.bat`) can be used to launch scripts. | `"/usr/local/bin/firefox_mcp_host.py"` (Linux/macOS) or `"C:\path\to\firefox_mcp_host.bat"` (Windows) |
| `type` | String | Specifies the communication method. For standard input/output, this must be `"stdio"`. | `"stdio"` |
| `allowed_extensions` | Array of String | A list of Firefox extension IDs that are permitted to communicate with this native application. The extension's manifest must explicitly define its ID. | `["your_extension_id@mozilla.org"]` |

This table is extremely valuable as it provides the precise structure and key fields for the Native Messaging Host manifest. Correctly configuring this file is a common point of failure in Native Messaging implementations. By detailing each field and providing examples, it offers clear guidance for developers, ensuring the crucial link between the Firefox extension and the local MCP server is established correctly. The inclusion of platform-specific path considerations and the requirement for the extension's explicit ID are practical details that prevent common setup errors.

## 6. Integration Design: Firefox Extension as an MCP Tool Provider

The integration design centers on the Native Messaging Host serving a dual role: it acts as the MCP server, communicating with `gemini-cli`, and as the intermediary that translates MCP tool calls into actions performed by the Firefox WebExtension.

### 6.1. Revised Architecture Overview

The refined architecture establishes a clear chain of command and communication:

- **`gemini-cli` (AI Assistant):** This component functions as the MCP Host and Client. It initiates requests, discovers available tools, and invokes them according to the Model Context Protocol.
- **Native Messaging Host (NM Host) / MCP Server:** This is a local application, typically a Python or Node.js script, that acts as the primary bridge. Its responsibilities include:
  - Implementing the MCP Server logic: It listens for JSON-RPC `tools/list` and `tools/call` requests originating from `gemini-cli`.
  - Defining and exposing MCP tools, such as `openUrlInPrivateBrowser`, with appropriate input and output schemas.
  - Communicating with the Firefox WebExtension via Native Messaging (using its `stdin/stdout` pipes) to request browser-specific actions.
  - Executing system commands (e.g., `firefox -private-window`) to launch Firefox if the browser is not already running.
- **Firefox WebExtension:** This component provides the actual browser capabilities. It acts as a client to the Native Messaging Host, receiving instructions and executing browser API calls (e.g., opening tabs or windows). It requires the `tabs`, `windows`, and `nativeMessaging` permissions, and crucially, the user must explicitly enable it to run in Private Browsing windows.

This multi-layered client-server interaction requires careful message routing and state management. `gemini-cli` (the MCP Client) communicates with the Native Host (the MCP Server). The Native Host then acts as a client to the Firefox Extension via Native Messaging. This intricate chain of command means the native host is the central orchestrator and translator, handling both MCP and Native Messaging protocols. This complexity necessitates robust error handling and clear message contracts at each layer to ensure reliable operation.

### 6.2. Designing the Firefox Extension's Background Script

The background script of the Firefox WebExtension is the core logic handler within the browser environment.

- **Permissions:** The extension's `manifest.json` must declare the `tabs`, `windows`, and `nativeMessaging` permissions. A critical prerequisite is that the user must explicitly enable the "Run in Private Windows" option for the extension in Firefox's Add-ons Manager.
- **Receiving Requests from NM Host:** The background script will establish a persistent connection with the Native Messaging Host using `browser.runtime.connectNative()`. It will then implement a `port.onMessage` listener to receive internal JSON messages from the NM Host. These internal messages will encapsulate the specific browser actions requested by the AI assistant (e.g., "open this URL").
- **Implementing Browser Actions (`openUrlInPrivateTab`):**
  - Upon receiving a request to open a URL, the extension first needs to determine the current state of Firefox. It can use `browser.windows.getAll()` to check if any Firefox windows are currently open.
  - The extension itself cannot directly launch Firefox if it is not running. This responsibility falls to the Native Messaging Host, which will have already executed `firefox -private-window <URL>` if necessary.
  - If Firefox is already running, the extension will then query for an existing private window using `browser.windows.getAll({ incognito: true })`.
  - If a private window is found, the extension will create a new tab within that window: `browser.tabs.create({ url: requestedUrl, windowId: existingPrivateWindowId })`.
  - If no private window exists but Firefox is running, the extension will create a new private window: `browser.windows.create({ url: requestedUrl, incognito: true })`.
- **Checking Firefox Status (`isFirefoxRunning`):** The extension can expose a simple status check to the Native Messaging Host by querying `browser.windows.getAll()`. If the returned array of windows is empty, Firefox is likely not running.

### 6.3. Implementing the Native Messaging Host / MCP Server

The Native Messaging Host is the core logic component that translates between the MCP and WebExtension worlds.

- **MCP Server Logic:** The host will implement the necessary MCP server endpoints. It will respond to `tools/list` requests from `gemini-cli` by advertising the `openUrlInPrivateBrowser` tool, including its name, description, and `inputSchema`. It will then handle `tools/call` requests for this tool, parsing the incoming JSON-RPC message to extract the requested URL.
- **Communication with Extension:** After processing an MCP `tools/call` request, the Native Messaging Host will send an internal message to the Firefox extension (via the `runtime.Port` established by `connectNative()`) containing the URL and instructions to open it. It will await a response from the extension indicating success or failure.
- **Launching Firefox:** The Native Messaging Host is responsible for the "chicken and egg" problem of launching Firefox. If the extension reports that Firefox is not running (or if an initial check for a running Firefox process fails), the Native Messaging Host will execute the `firefox -private-window <URL>` command using its system process execution capabilities (e.g., Python's `subprocess.run()` or Node.js's `child_process.spawn()`). This means the Native Messaging Host acts as the orchestrator, deciding whether to launch Firefox externally or instruct the running extension to create a new window/tab.
- **Error Handling:** The Native Messaging Host must robustly handle errors at multiple levels:
  - **MCP Protocol Errors:** Invalid JSON-RPC messages or malformed tool calls from `gemini-cli` should result in appropriate MCP error responses.
  - **Native Messaging Errors:** Issues in communication with the Firefox extension (e.g., malformed messages, unexpected disconnections) need to be logged and potentially reported back to `gemini-cli`.
  - **Browser API Errors:** Failures in the Firefox extension (e.g., permission denied for private browsing, invalid URL) should be relayed from the extension to the Native Messaging Host, and then converted into MCP error responses.
  - **System Command Errors:** Failures in launching Firefox via the command line should also be captured and reported.
- **Handling Responses to AI Assistant:** Once the browser action is completed (or an error occurs), the Native Messaging Host formats the result (success or detailed error) into a JSON-RPC 2.0 response payload and sends it back to `gemini-cli` via `stdout`.

## 7. User Consent, Security, and Debugging

The successful and responsible deployment of this debug extension hinges on meticulous attention to user consent, robust security measures, and a comprehensive debugging strategy across all integrated components.

### 7.1. User Consent Management

User consent is a multi-layered requirement in this architecture:

- **Extension Installation:** During the installation of the Firefox WebExtension, or subsequently via the Add-ons Manager, users are explicitly prompted to grant permission for the extension to "Run in Private Windows". This is a non-negotiable security feature implemented by Firefox to protect user privacy.
- **Native Messaging:** The Native Messaging Host's configuration, specifically its `allowed_extensions` list, programmatically controls which Firefox extensions can communicate with it. While this is a technical permission, it forms part of the overall trust chain.
- **Tool Invocation (MCP):** The Model Context Protocol places a strong emphasis on user consent and control over tool execution, particularly for operations that might be considered "destructive" or involve accessing user data. Although opening a URL is generally non-destructive, launching a new browser instance or a private window could be perceived as a sensitive action. The MCP specification explicitly recommends presenting "confirmation prompts to the user for operations".

Implementing user consent for tool execution, such as prompting "AI wants to open URL X in private mode. Allow?", requires careful consideration of the user interface within the WebExtension. While the standard `window.prompt()` API exists , it creates a modal dialog that can be disruptive and is generally discouraged for frequent use in extensions. A more user-friendly approach involves utilizing Firefox's `notifications` API. Notifications can include interactive action buttons (e.g., "Allow", "Deny"). The Native Messaging Host would send a message to the extension to display such a notification, await the user's response (via a `notifications.onButtonClicked` listener), and then proceed with or abort the URL opening based on the user's choice. This method provides a less intrusive yet secure way to incorporate the "human in the loop" principle for MCP tools.

### 7.2. Security Considerations

Given the interaction with a native application and sensitive browser modes, several security aspects demand attention:

- **Native Messaging Host Vulnerabilities:** The Native Messaging Host executes system commands, making it a potential vector for command injection vulnerabilities if inputs are not rigorously validated. It is imperative to sanitize all data received from the extension (which ultimately originates from the AI assistant) before using it in shell commands. Direct concatenation of user-provided URLs into shell commands without proper escaping is a critical security flaw.
- **Trust Chain:** The overall security of the system relies on the user's trust in both the Firefox extension and, more critically, the native application. The native application operates outside the browser's sandbox and control. Developers must ensure the integrity and trustworthiness of the Native Messaging Host.
- **Least Privilege:** The Native Messaging Host should be designed with the principle of least privilege, possessing only the necessary permissions to perform its designated functions and nothing more.

### 7.3. Debugging Strategy

Debugging a multi-layered system involving a WebExtension, a Native Messaging Host, and an AI agent requires a coordinated and systematic approach.

- **WebExtension Debugging:** The `about:debugging` interface is the primary tool for inspecting the Firefox WebExtension. Developers should utilize the Console for viewing logs from background scripts and extension pages, and the Debugger for setting breakpoints and stepping through JavaScript code.
- **Native Messaging Host Debugging:** The native application should implement robust logging mechanisms, directing debug output to `stderr` to avoid interfering with the `stdin/stdout` communication channel used for Native Messaging. Standard debugging tools for the chosen language (e.g., Python debugger, Node.js debugger) should be employed to step through the native code.
- **MCP Communication Debugging:** Logging incoming and outgoing JSON-RPC messages on the Native Messaging Host side is crucial for verifying adherence to the MCP specification. `gemini-cli` itself may offer debug flags (e.g., `-d`) that can provide additional insights into its internal operations and tool invocation process.
- **Inter-process Communication:** Diagnosing issues related to the Native Messaging protocol, such as malformed JSON or incorrect message length prefixes, can be challenging. These often manifest as generic "Failed to start native messaging host" or "Incorrect implementation of the communication protocol" errors. Meticulous attention to the message framing (32-bit length prefix, UTF-8 encoding) is required.

The debugging process for this multi-layered system will be complex, necessitating simultaneous monitoring of Firefox's `about:debugging` console , the Native Host's `stderr` , and `gemini-cli`'s own debug output. This implies the need for a structured debugging workflow, potentially involving multiple terminal windows or an integrated development environment configured to capture logs from all components concurrently, to effectively diagnose issues related to protocol mismatches or inter-process communication failures.

### 7.4. Valuable Table: Security Considerations and Mitigation Strategies

The integration of a Firefox extension with a native application and an AI assistant, particularly when dealing with private browsing, introduces several security risks. This table outlines key considerations and proposed mitigation strategies.

| Security Consideration | Description of Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| User Consent for Private Browsing | Firefox extensions are not enabled in Private Browsing by default. Without explicit user permission, core functionality will fail, or the extension might attempt to operate in an unintended context. | **Mandatory User Action:** The extension's installation or first-run experience must clearly instruct the user to enable "Run in Private Windows" in `about:addons`. |
| Native Messaging Host Arbitrary Code Execution | The Native Messaging Host runs as a local application with system privileges. A malicious or compromised host could execute arbitrary code, access sensitive files, or perform unauthorized actions on the user's machine. | **Trust and Verification:** Users must only install Native Messaging Hosts from trusted sources. Developers should open-source the host's code for community review. **Least Privilege:** Design the host to perform only necessary actions. |
| Command Injection in Native Host | If user-provided input (e.g., URLs from the AI assistant) is directly used in shell commands executed by the Native Messaging Host, it can lead to command injection vulnerabilities. | **Input Validation & Sanitization:** Rigorously validate and sanitize all inputs received by the Native Messaging Host before using them in system commands. Use parameterized command execution methods where possible (e.g., `subprocess.run(..., shell=False)` in Python, `child_process.spawn()` in Node.js) to avoid shell interpretation. |
| MCP Tool Invocation Consent | MCP tools can perform actions with side effects. The protocol emphasizes user consent before tool invocation to prevent unintended operations by the AI. | **In-Extension User Confirmation:** Before executing an `openUrlInPrivateBrowser` request, the Firefox extension should display a non-modal notification with "Allow" / "Deny" buttons for user confirmation. The Native Messaging Host awaits this confirmation. |
| Data Privacy (AI Access to Browser Data) | While opening in private mode mitigates some data retention, the AI assistant could potentially request URLs that expose sensitive information if not carefully managed. | **Explicit Tool Scope:** Ensure the `openUrlInPrivateBrowser` tool only takes a URL and does not expose other browser state or content back to the AI without explicit, additional user consent. |

This table provides a comprehensive overview of the critical security considerations inherent in this multi-component system and outlines actionable mitigation strategies. Addressing these points is paramount for building a secure and trustworthy debug extension. The emphasis on explicit user consent at multiple layers—for extension installation, private browsing access, and individual tool invocations—reflects a commitment to user control and privacy. Furthermore, the focus on input validation and secure coding practices for the Native Messaging Host is crucial for preventing vulnerabilities like command injection, which could severely compromise system integrity.

## 8. Implementation Roadmap and Best Practices

Developing this multi-component debug extension requires a structured approach. The following roadmap outlines the key implementation steps and best practices.

### 8.1. Step-by-Step Development Guide

- **Prerequisites Setup:**
  - Install Node.js (version 18 or higher) as it is a prerequisite for `gemini-cli` and a viable option for the Native Messaging Host.
  - Install `gemini-cli` following its official documentation.
- **Firefox WebExtension Development:**
  - Create the `manifest.json` file, declaring necessary permissions (`tabs`, `windows`, `nativeMessaging`) and defining a specific `browser_specific_settings.gecko.id` for the extension to be recognized by the Native Messaging Host.
  - Develop the `background.js` script to handle Native Messaging communication, implement browser API calls for tab/window management, and manage user confirmation notifications.
- **Native Messaging Host / MCP Server Development:**
  - Choose a programming language (e.g., Python or Node.js) for the Native Messaging Host.
  - Implement the MCP server logic to respond to `tools/list` and `tools/call` JSON-RPC requests from `gemini-cli`. Define the `openUrlInPrivateBrowser` tool with its `inputSchema`.
  - Implement the Native Messaging protocol for communication with the Firefox extension, handling length-prefixed JSON messages over `stdin/stdout`.
  - Integrate system command execution (e.g., `subprocess` in Python, `child_process` in Node.js) to launch Firefox with the `-private-window` argument when required.
- **Native Messaging Host Manifest Installation:**
  - Create the Native Messaging Host manifest (`.json` file) with the correct `name`, `path`, `type`, and `allowed_extensions`.
  - Install the manifest in the appropriate, platform-specific location (registry on Windows, specific directories on Linux/macOS).
- **Initial Setup and Configuration:**
  - Load the Firefox WebExtension temporarily via `about:debugging`.
  - Manually enable the "Run in Private Windows" option for the extension in Firefox's Add-ons Manager.
  - Configure `gemini-cli` to recognize the Native Messaging Host as a local MCP server, typically by adding its configuration to `~/.gemini/settings.json`.

### 8.2. Code Structure Recommendations

- **Firefox Extension:**
  - `manifest.json`: Defines permissions, background script, and explicit extension ID.
  - `background.js`: Contains the main event listeners, Native Messaging client logic, browser API calls (`tabs.create`, `windows.create`, `notifications.create`, `notifications.onButtonClicked`), and internal message handling.
- **Native Messaging Host / MCP Server:**
  - `firefox_mcp_host.py` (or `.js`): Main script handling MCP JSON-RPC parsing, tool dispatching, Native Messaging I/O, system command execution, and error reporting.
  - `firefox_mcp_host.json`: The Native Messaging Host manifest file.
  - Consider a separate utility module for `stdio` message framing/unframing.

### 8.3. Testing Strategies

Comprehensive testing is crucial for a multi-component system:

- **Unit Tests:** Develop unit tests for individual functions within both the Firefox extension's background script and the Native Messaging Host. This includes testing JSON parsing, message framing, and internal logic.
- **Integration Tests:**
  - **Extension <-> Native Messaging Host:** Verify bidirectional communication, ensuring correct message exchange and response handling.
  - **Native Messaging Host <-> `gemini-cli` (MCP Protocol):** Test `tools/list` and `tools/call` requests and responses, validating adherence to the MCP JSON-RPC 2.0 specification.
  - **Native Messaging Host Executing Firefox:** Test the host's ability to correctly launch Firefox in private mode via command-line arguments, including scenarios where Firefox is not running.
- **End-to-End Tests:** Simulate the full workflow: `gemini-cli` requesting a URL, the Native Messaging Host processing it, the Firefox extension opening it in a private tab/window, and user confirmation flow.
- **Manual Testing:** Crucial for verifying user consent flows, the visual behavior of private browsing windows/tabs, and overall user experience.

The Native Messaging Host setup (manifest location, executable path, and the potential use of batch files for Windows Python scripts) is highly platform-dependent. A robust solution must account for the distinct requirements of Windows, macOS, and Linux operating systems. This implies that the installation process for the debug extension will be more involved than a typical WebExtension, likely necessitating platform-specific instructions or an automated installer script. Similarly, the `subprocess` or `child_process` calls used for launching Firefox may require adjustments based on the operating system's command structure or the specific path to the Firefox executable, adding a layer of complexity to deployment and user setup.

## 9. Conclusion

The development of a Firefox debug extension capable of communicating with AI assistants like `gemini-cli` via the Model Context Protocol presents a sophisticated technical challenge, requiring a multi-layered architectural approach. This report has detailed a robust solution involving a Firefox WebExtension, a Native Messaging Host acting as an MCP server, and the `gemini-cli` AI agent.

The analysis highlights that Firefox's privacy-by-design philosophy mandates explicit user consent for extensions operating in private browsing mode, a critical consideration for both functionality and user trust. The Model Context Protocol's structured, JSON-RPC-based communication, particularly its "Tools" concept, provides a standardized and extensible mechanism for AI agents to interact with browser capabilities. The Native Messaging API serves as the indispensable bridge, enabling secure inter-process communication between the sandboxed extension and the local MCP server, which can then execute system-level commands like launching Firefox in private mode.

The integration necessitates careful management of user consent at multiple levels, from initial extension permissions to real-time confirmation for AI-driven actions. Security is paramount, requiring rigorous input validation in the Native Messaging Host to prevent command injection and a clear understanding of the trust chain. Debugging this complex system demands a multi-faceted approach, leveraging Firefox's built-in developer tools alongside standard debugging utilities for the native application and AI agent.

This architecture offers a powerful framework for extending AI agent capabilities into the web browsing environment, particularly for privacy-sensitive tasks or debugging scenarios. Future enhancements could include exposing a wider range of browser functionalities as MCP tools, enabling more granular AI control over web content, or developing more sophisticated user interfaces for managing AI interactions and permissions.

## Sources used in the report

- [extensionworkshop.com](extensionworkshop.com)
- [Debugging | Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/debugging/)
- [medium.com](medium.com)
- [Gemini CLI Tutorial Series — Part 2 : Gemini CLI Command line parameters | by Romin Irani | Google Cloud - Medium](https://medium.com/google-cloud/gemini-cli-tutorial-series-part-2-gemini-cli-command-line-parameters-5c79f05813a4)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [about:debugging — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/devtools-user/about_debugging/index.html)
- [addons.mozilla.org](addons.mozilla.org)
- [Open in Private Mode – Get this Extension for Firefox (en-US)](https://addons.mozilla.org/en-US/firefox/addon/open-in-private-mode/)
- [developer.mozilla.org](developer.mozilla.org)
- [tabs.Tab - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab)
- [reddit.com](reddit.com)
- [Gemini CLI: A comprehensive guide to understanding, installing, and leveraging this new Local AI Agent - Reddit](https://www.reddit.com/r/Gemini/comments/1c5z01z/gemini_cli_a_comprehensive_guide_to/)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Model Context Protocol: Introduction](https://modelcontextprotocol.io/introduction)
- [superuser.com](superuser.com)
- [Enable all Firefox extensions in private mode by default - Super User](https://superuser.com/questions/1232483/enable-all-firefox-extensions-in-private-mode-by-default)
- [support.mozilla.org](support.mozilla.org)
- [Extensions in Private Browsing | Firefox Help - Mozilla Support](https://support.mozilla.org/en-US/kb/extensions-private-browsing)
- [developer.mozilla.org](developer.mozilla.org)
- [windows.create() - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create)
- [winaero.com](winaero.com)
- [How to run Firefox in private browsing mode from the command line or a shortcut - Winaero](https://winaero.com/how-to-run-firefox-in-private-browsing-mode-from-the-command-line-or-a-shortcut/)
- [developer.mozilla.org](developer.mozilla.org)
- [tabs.create() - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create)
- [arshren.medium.com](arshren.medium.com)
- [A Quick and Simple Explanation of Model Context Protocol-MCP | by Renu Khandelwal](https://arshren.medium.com/a-quick-and-simple-explanation-of-model-context-protocol-mcp-8724d3f5e98)
- [ibm.com](ibm.com)
- [www.ibm.com](https://www.ibm.com/docs/en/datapower-gateway/10.5?topic=20-json-rpc-support)
- [cloud.google.com](cloud.google.com)
- [Gemini CLI | Gemini for Google Cloud](https://cloud.google.com/gemini/docs/cli)
- [milvus.io](milvus.io)
- [How is JSON-RPC used in the Model Context Protocol? - Milvus](https://milvus.io/blog/how-is-json-rpc-used-in-the-model-context-protocol.md)
- [developers.google.com](developers.google.com)
- [Use agentic chat as a pair programmer | Gemini Code Assist - Google for Developers](https://developers.google.com/codelabs/gemini-code-assist-agentic-chat)
- [innoq.com](innoq.com)
- [Building Standardized AI Tools with the Model Context Protocol (MCP) - INNOQ](https://www.innoq.com/en/blog/mcp-standardized-ai-tools/)
- [medium.com](medium.com)
- [Gemini CLI with MCP Server: Expanding Possibilities with Google Apps Script - Medium](https://medium.com/@abdenourelhadj/gemini-cli-with-mcp-server-expanding-possibilities-with-google-apps-script-e5b3e6f26b02)
- [dev.to](dev.to)
- [A Practical Guide to Gemini CLI - DEV Community](https://dev.to/googlecloud/a-practical-guide-to-gemini-cli-3l2c)
- [speakeasy.com](speakeasy.com)
- [What are MCP Tools? - Speakeasy](https://www.speakeasy.com/docs/mcp/tools)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Tools - Model Context Protocol](https://modelcontextprotocol.io/tools)
- [github.com](github.com)
- [JosephusPaye/chrome-native-bridge: A utility for building Chrome native messaging hosts with Node.js - GitHub](https://github.com/JosephusPaye/chrome-native-bridge)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Specification - Model Context Protocol](https://modelcontextprotocol.io/specification)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [Subprocess Module — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/testing/mozbase/mozprocess/subprocess.html)
- [stackoverflow.com](stackoverflow.com)
- [How to message child process in Firefox add-on like Chrome native messaging](https://stackoverflow.com/questions/40574050/how-to-message-child-process-in-firefox-add-on-like-chrome-native-messaging)
- [npmjs.com](npmjs.com)
- [native-messaging - NPM](https://www.npmjs.com/package/native-messaging)
- [developer.mozilla.org](developer.mozilla.org)
- [Notification: actions property - Web APIs - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Notification/actions)
- [milvus.io](milvus.io)
- [What are tools in Model Context Protocol (MCP) and how do models use them? - Milvus](https://milvus.io/blog/what-are-tools-in-model-context-protocol-mcp-and-how-do-models-use-them.md)
- [redhat.com](redhat.com)
- [Model Context Protocol (MCP): Understanding security risks and controls - Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [sunnyzhou-1024.github.io](sunnyzhou-1024.github.io)
- [Native Messaging - Google Chrome](https://sunnyzhou-1024.github.io/notes/chrome-extension/native-messaging.html)
- [developer.mozilla.org](developer.mozilla.org)
- [Window: prompt() method - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt)
- [pypi.org](pypi.org)
- [nativemessaging - PyPI](https://pypi.org/project/nativemessaging/)
- [dzone.com](dzone.com)
- [Building Custom Tools With Model Context Protocol - DZone](https://dzone.com/articles/building-custom-tools-with-model-context-protocol)
- [seangoedecke.com](seangoedecke.com)
- [Model Context Protocol explained as simply as possible - Sean Goedecke](https://seangoedecke.com/posts/2024-05-20-mcp-explained/)
- [npmjs.com](npmjs.com)
- [node-native-messaging-host - NPM](https://www.npmjs.com/package/node-native-messaging-host)
- [learn.microsoft.com](learn.microsoft.com)
- [Native messaging - Microsoft Edge Developer documentation](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/native-messaging)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Tools - Model Context Protocol](https://modelcontextprotocol.io/tools)
- [realpython.com](realpython.com)
- [The subprocess Module: Wrapping Programs With Python](https://realpython.com/python-subprocess/)
- [stackoverflow.com](stackoverflow.com)
- [Using python with subprocess Popen - Stack Overflow](https://stackoverflow.com/questions/89228/using-python-with-subprocess-popen)
- [developer.mozilla.org](developer.mozilla.org)
- [Work with the Tabs API - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)
- [support.mozilla.org](support.mozilla.org)
- [Extensions in Private Browsing | Pomoc wo Firefox - Mozilla Support](https://support.mozilla.org/pl/kb/extensions-private-browsing)
- [developer.mozilla.org](developer.mozilla.org)
- [tabs.query() - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/query)
- [bun.sh](bun.sh)
- [Bun v1.2.18 | Bun Blog](https://bun.sh/blog/bun-v1.2.18)
- [webcluesinfo.medium.com](webcluesinfo.medium.com)
- [Spawning child processes in Node.js. | by WebClues Infotech | Medium](https://webcluesinfo.medium.com/spawning-child-processes-in-node-js-164f4c374f5b)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [Incognito Implementation — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/mobile/android/components/browser/tabmodel/incognito/implementation/)
- [knowledge.prokeep.com](knowledge.prokeep.com)
- [How to Use Private Browsing Mode in Mozilla Firefox for Troubleshooting - Help Center](https://knowledge.prokeep.com/how-to-use-private-browsing-mode-in-mozilla-firefox-for-troubleshooting)
- [developer.mozilla.org](developer.mozilla.org)
- [notifications.NotificationOptions - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions)
- [reddit.com](reddit.com)
- [Native Messaging Hosts: what are they and are they friendly? : r/firefox - Reddit](https://www.reddit.com/r/firefox/comments/101t2b1/native_messaging_hosts_what_are_they_and_are_they/)
- [developer.mozilla.org](developer.mozilla.org)
- [runtime.sendNativeMessage() - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendNativeMessage)
- [developer.mozilla.org](developer.mozilla.org)
- [notifications.onButtonClicked - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/onButtonClicked)
- [developer.mozilla.org](developer.mozilla.org)
- [runtime.onMessage - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage)
- [developer.mozilla.org](developer.mozilla.org)
- [Content scripts - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [developer.mozilla.org](developer.mozilla.org)
- [Notifications - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [User Actions — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/toolkit/components/extensions/user-actions.html)
- [nodejs.org](nodejs.org)
- [Child process | Node.js v24.3.0 Documentation](https://nodejs.org/api/child_process.html)
- [developer.mozilla.org](developer.mozilla.org)
- [runtime.sendMessage() - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendMessage)
- [developer.mozilla.org](developer.mozilla.org)
- [Native manifests - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)
- [developer.chrome.com](developer.chrome.com)
- [Native messaging | Chrome Extensions](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [developer.mozilla.org](developer.mozilla.org)
- [permissions - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Tools - Model Context Protocol](https://modelcontextprotocol.io/tools)
- [github.com](github.com)
- [webextensions-examples/native-messaging/README.md at main - GitHub](https://github.com/mdn/webextensions-examples/blob/main/native-messaging/README.md)
- [developer.mozilla.org](developer.mozilla.org)
- [Native messaging - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)

## Sources read but not used in the report

- [developer.mozilla.org](developer.mozilla.org)
- [windows - Mozilla | MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows)
- [developer.mozilla.org](developer.mozilla.org)
- [Content Security Policy - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_Security_Policy)
- [reeracoen.sg](reeracoen.sg)
- [Commanding the Future: How Google's Gemini CLI Will Transform Singapore's Workflows](https://www.reeracoen.sg/en/news/commanding-the-future-how-googles-gemini-cli-will-transform-singapores-workflows)
- [github.com](github.com)
- [MCP Server Requires Authentication · Issue #2427 · google-gemini/gemini-cli - GitHub](https://github.com/google-gemini/gemini-cli/issues/2427)
- [developer.mozilla.org](developer.mozilla.org)
- [Storage quotas and eviction criteria - Web APIs - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [developer.mozilla.org](developer.mozilla.org)
- [proxy.settings - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/settings)
- [support.mozilla.org](support.mozilla.org)
- [private window by default? | Firefox Support Forum](https://support.mozilla.org/en-US/questions/1232483)
- [youtube.com](youtube.com)
- [How to Install & Use Gemini CLI + MCP: A Step-by-Step Tutorial - YouTube](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
- [datacamp.com](datacamp.com)
- [Gemini CLI: A Guide With Practical Examples - DataCamp](https://www.datacamp.com/tutorial/gemini-cli-a-guide-with-practical-examples)
- [dev.to](dev.to)
- [Google Gemini CLI Tutorial: How to Install and Use It (With Images) - DEV Community](https://dev.to/googlecloud/google-gemini-cli-tutorial-how-to-install-and-use-it-with-images-3l2c)
- [knowledge.prokeep.com](knowledge.prokeep.com)
- [knowledge.prokeep.com](https://knowledge.prokeep.com/how-to-use-private-browsing-mode-in-mozilla-firefox-for-troubleshooting)
- [support.mozilla.org](support.mozilla.org)
- [Private Browsing - Use Firefox without saving history - Mozilla Support](https://support.mozilla.org/en-US/kb/private-browsing-use-firefox-without-history)
- [software.dzhuvinov.com](software.dzhuvinov.com)
- [JSON-RPC 2.0 : Base Java Classes - [d]zhuvinov [s]oftware](https://www.software.dzhuvinov.com/json-rpc-2.0-base.html)
- [blog.google](blog.google)
- [Google announces Gemini CLI: your open-source AI agent](https://blog.google/products/gemini/google-gemini-cli/)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [Command Line Parameters — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/devtools-user/command_line_parameters/index.html)
- [support.mozilla.org](support.mozilla.org)
- [command line parameters for firefox - Mozilla Support](https://support.mozilla.org/en-US/questions/1232483)
- [docs.opendaylight.org](docs.opendaylight.org)
- [JSON-RPC Developer Guide](https://docs.opendaylight.org/en/latest/developer-guide/json-rpc-developer-guide.html)
- [a2aprotocol.org](a2aprotocol.org)
- [What is JSON-RPC 2.0: A Comprehensive Guide - A2A Protocol Documentation](https://a2aprotocol.org/json-rpc-2-0/)
- [reddit.com](reddit.com)
- [Gemini CLI: A comprehensive guide to understanding, installing, and leveraging this new Local AI Agent : r/GeminiAI - Reddit](https://www.reddit.com/r/GeminiAI/comments/1c5z01z/gemini_cli_a_comprehensive_guide_to/)
- [addons.mozilla.org](addons.mozilla.org)
- [Always Open Privately – Get this Extension for Firefox (en-US)](https://addons.mozilla.org/en-US/firefox/addon/always-open-privately/)
- [developer.mozilla.org](developer.mozilla.org)
- [The WebSocket API (WebSockets) - Web APIs - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [addons.mozilla.org](addons.mozilla.org)
- [Monitor WebSocket frames (new) – Get this Extension for Firefox (en-US)](https://addons.mozilla.org/en-US/firefox/addon/monitor-websocket-frames-new/)
- [reddit.com](reddit.com)
- [Is there any way of always starting Firefox in private browsing? - Reddit](https://www.reddit.com/r/firefox/comments/101t2b1/is_there_any_way_of_always_starting_firefox_in/)
- [youtube.com](youtube.com)
- [Gemini CLI + ANY MCP Server — Step‑by‑Step Tutorial - YouTube](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
- [firefox-source-docs.mozilla.org](firefox-source-docs.mozilla.org)
- [PrivateBrowsing — Firefox Source Docs documentation - Mozilla](https://firefox-source-docs.mozilla.org/mobile/android/components/browser/tabmodel/incognito/)
- [github.com](github.com)
- [Specification and documentation for the Model Context Protocol - GitHub](https://github.com/model-context-protocol/specification)
- [modelcontextprotocol.io](modelcontextprotocol.io)
- [Specification - Model Context Protocol](https://modelcontextprotocol.io/specification)
- [github.com](github.com)
- [Model Context Protocol - GitHub](https://github.com/model-context-protocol)
- [developer.mozilla.org](developer.mozilla.org)
- [Browser extensions - MDN Web Docs - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [github.com](github.com)
- [github.com](https://github.com/mdn/webextensions-examples/blob/main/native-messaging/README.md)
- [github.com](github.com)
- [content/files/en-us/mozilla/add-ons/webextensions/api/notifications/getall/index.md at main](https://github.com/mdn/content/blob/main/files/en-us/mozilla/add-ons/webextensions/api/notifications/getall/index.md)
- [byteplus.com](byteplus.com)
- [MCP Schema Definitions: Complete Guide & Integration Tips - BytePlus](https://www.byteplus.com/docs/mcp/schema-definitions)
- [mozilla.github.io](mozilla.github.io)
- [WebExtension.PermissionPromptResponse (geckoview 142.0.20250625034313 API)](https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/WebExtension.PermissionPromptResponse.html)
- [developer.mozilla.org](developer.mozilla.org)
- [runtime.onMessageExternal - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessageExternal)
- [docs.python.org](docs.python.org)
- [webbrowser — Convenient web-browser controller — Python 3.13.5 documentation](https://docs.python.org/3/library/webbrowser.html)
- [developer.mozilla.org](developer.mozilla.org)
- [runtime - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime)
- [addons.mozilla.org](addons.mozilla.org)
- [WebAPI Blocker – Get this Extension for Firefox (en-US)](https://addons.mozilla.org/en-US/firefox/addon/webapi-blocker/)
- [developer.mozilla.org](developer.mozilla.org)
- [Chrome incompatibilities - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- [developer.mozilla.org](developer.mozilla.org)
- [optional_permissions - Mozilla - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/optional_permissions)
- [youtube.com](youtube.com)
- [Top 10 MCP Use Cases - Using Claude & Model Context Protocol - YouTube](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
