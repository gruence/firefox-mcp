#!/bin/bash

set -e

# Get the absolute path to the script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define the host name and manifest file name
HOST_NAME="firefox_mcp_host"
MANIFEST_NAME="${HOST_NAME}.json"

# Define the target directory for the manifest based on the OS
if [ "$(uname)" == "Darwin" ]; then
  TARGET_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
elif [ "$(uname)" == "Linux" ]; then
  TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
else
  echo "Unsupported OS: $(uname)" >&2
  exit 1
fi

# Create the target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Create the manifest file
cat <<EOF > "$TARGET_DIR/$MANIFEST_NAME"
{
  "name": "$HOST_NAME",
  "description": "MCP server and native messaging host for Firefox.",
  "path": "$DIR/host.js",
  "type": "stdio",
  "allowed_extensions": [ "mcp@firefox.host" ]
}
EOF

# Make the host script executable
chmod +x "$DIR/host.js"

echo "Native messaging host for $HOST_NAME has been installed."
