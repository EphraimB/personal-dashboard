#!/usr/bin/env bash
# ==============================================================================
# ARES CITY OS — HEADLESS ONEDRIVE AUTHENTICATION SCRIPT FOR RASPBERRY PI
# ==============================================================================
# This script uses Microsoft OAuth2 Device Code Flow to authorize access to
# OneDrive photos over SSH without requiring a browser/keyboard on the Pi.
# ==============================================================================

set -e

CLIENT_ID="${ONEDRIVE_CLIENT_ID:-0614e717-b1a7-47b8-9369-34b868615b3c}" # Standard Microsoft Public Client ID or custom
SCOPE="offline_access Files.Read User.Read"
TOKEN_FILE="$(dirname "$0")/../dashboard/onedrive_tokens.json"

echo "=================================================================="
echo "⚡ ARES CITY OS — ONEDRIVE HEADLESS AUTHENTICATION (DEVICE CODE)"
echo "=================================================================="
echo ""

# 1. Request Device Code from Microsoft OAuth2 Endpoint
echo "📡 Requesting Device Code from Microsoft..."
RESP=$(curl -s -X POST "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode" \
  -d "client_id=${CLIENT_ID}" \
  -d "scope=${SCOPE}")

USER_CODE=$(echo "$RESP" | grep -o '"user_code":"[^"]*' | cut -d'"' -f4)
VERIFICATION_URI=$(echo "$RESP" | grep -o '"verification_uri":"[^"]*' | cut -d'"' -f4)
DEVICE_CODE=$(echo "$RESP" | grep -o '"device_code":"[^"]*' | cut -d'"' -f4)
INTERVAL=$(echo "$RESP" | grep -o '"interval":[^,}]*' | cut -d':' -f2 | tr -d ' ')
EXPIRES_IN=$(echo "$RESP" | grep -o '"expires_in":[^,}]*' | cut -d':' -f2 | tr -d ' ')

if [ -z "$USER_CODE" ] || [ -z "$DEVICE_CODE" ]; then
  echo "❌ Failed to retrieve Device Code from Microsoft."
  echo "Response: $RESP"
  exit 1
fi

if [ -z "$INTERVAL" ]; then INTERVAL=5; fi

echo ""
echo "------------------------------------------------------------------"
echo "🔑 AUTHENTICATION REQUIRED"
echo "------------------------------------------------------------------"
echo "1. On your phone, laptop, or tablet, open this URL:"
echo "   👉 ${VERIFICATION_URI:-https://microsoft.com/devicelogin}"
echo ""
echo "2. Enter this 8-character code:"
echo "   👉  $USER_CODE"
echo "------------------------------------------------------------------"
echo ""
echo "⏳ Waiting for authorization... (Press Ctrl+C to cancel)"

# 2. Poll Token Endpoint until user completes auth on their device
TOKEN_RESP=""
ELAPSED=0
EXPIRES_IN=${EXPIRES_IN:-900}

while [ $ELAPSED -lt $EXPIRES_IN ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  POLL_RES=$(curl -s -X POST "https://login.microsoftonline.com/common/oauth2/v2.0/token" \
    -d "client_id=${CLIENT_ID}" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
    -d "device_code=${DEVICE_CODE}")

  ERROR=$(echo "$POLL_RES" | grep -o '"error":"[^"]*' | cut -d'"' -f4 || true)

  if [ "$ERROR" = "authorization_pending" ]; then
    printf "."
  elif [ "$ERROR" = "slow_down" ]; then
    INTERVAL=$((INTERVAL + 5))
  elif [ -n "$ERROR" ] && [ "$ERROR" != "authorization_pending" ]; then
    echo ""
    echo "❌ Authentication error: $ERROR"
    echo "$POLL_RES"
    exit 1
  else
    # Success! Token received
    TOKEN_RESP="$POLL_RES"
    break
  fi
done

echo ""
if [ -z "$TOKEN_RESP" ]; then
  echo "❌ Authentication timed out."
  exit 1
fi

ACCESS_TOKEN=$(echo "$TOKEN_RESP" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$TOKEN_RESP" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Error parsing tokens."
  echo "Response: $TOKEN_RESP"
  exit 1
fi

# 3. Save tokens to file for Dashboard engine
mkdir -p "$(dirname "$TOKEN_FILE")"
cat <<EOF > "$TOKEN_FILE"
{
  "client_id": "$CLIENT_ID",
  "access_token": "$ACCESS_TOKEN",
  "refresh_token": "$REFRESH_TOKEN",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

chmod 600 "$TOKEN_FILE"

echo ""
echo "=================================================================="
echo "✅ SUCCESS! OneDrive Account Authenticated successfully."
echo "📁 Saved tokens to $TOKEN_FILE"
echo "🖼️ Your TV Dashboard will now stream photos from your OneDrive!"
echo "=================================================================="
