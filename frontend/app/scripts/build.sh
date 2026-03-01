#!/bin/bash

# Build script to inject API key from .env into config.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
CONFIG_FILE="$SCRIPT_DIR/../assets/js/config.js"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Load API_KEY from .env
set -a
source "$ENV_FILE"
set +a

if [ -z "$API_KEY" ]; then
    echo "Error: API_KEY not found in .env"
    exit 1
fi

# Escape special characters for sed
ESCAPED_API_KEY=$(printf '%s' "$API_KEY" | sed 's/[[\.*^$/&]/\\&/g')

# Replace placeholder with actual API key
sed "s/__API_KEY__/$ESCAPED_API_KEY/g" "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "API key injected successfully"
