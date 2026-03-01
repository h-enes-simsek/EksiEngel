#!/bin/sh

# Build script to inject API key from .env into config.js

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
CONFIG_FILE="$SCRIPT_DIR/../assets/js/config.js"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Load API_KEY from .env (compatible with sh)
API_KEY=""
while IFS='=' read -r key value; do
    case "$key" in
        API_KEY) API_KEY="$value" ;;
    esac
done < "$ENV_FILE"

if [ -z "$API_KEY" ]; then
    echo "Error: API_KEY not found in .env"
    exit 1
fi

# Escape special characters for sed
ESCAPED_API_KEY=$(echo "$API_KEY" | sed 's/[[\.*^$/&]/\\&/g')

# Replace placeholder with actual API key
sed "s/__API_KEY__/$ESCAPED_API_KEY/g" "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "API key injected successfully"
