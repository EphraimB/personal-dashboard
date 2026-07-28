#!/usr/bin/env bash
# ==============================================================================
# ARES CITY OS — HEADLESS GOOGLE CALENDAR AUTHENTICATION SCRIPT FOR RASPBERRY PI
# ==============================================================================
# This script uses Google OAuth2 Device Code Flow to authorize access to
# Google Calendar over SSH without requiring a browser/keyboard on the Pi.
# ==============================================================================

set -e

# Default Public Client ID for Google OAuth Device Flow (or set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
CLIENT_ID="${GOOGLE_CLIENT_ID:-1092892900742-v3s24i5q5824o9368u7341k5k341.apps.googleusercontent.com}"
CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
SCOPE="https://www.googleapis.com/auth/calendar.readonly"
TOKEN_FILE="$(dirname "$0")/../dashboard/google_calendar_tokens.json"

echo "=================================================================="
echo "⚡ ARES CITY OS — GOOGLE CALENDAR HEADLESS AUTHENTICATION"
echo "=================================================================="
echo ""

# 1. Request Device Code from Google OAuth2 Endpoint
echo "📡 Requesting Device Code from Google..."
RESP=$(curl -s -X POST "https://oauth2.googleapis.com/device/code" \
  -d "client_id=${CLIENT_ID}&scope=${SCOPE}")

USER_CODE=$(echo "$RESP" | grep -o '"user_code":"[^"]*' | cut -d'"' -f4 || true)
VERIFICATION_URL=$(echo "$RESP" | grep -o '"verification_url":"[^"]*' | cut -d'"' -f4 || true)
DEVICE_CODE=$(echo "$RESP" | grep -o '"device_code":"[^"]*' | cut -d'"' -f4 || true)
INTERVAL=$(echo "$RESP" | grep -o '"interval":[^,}]*' | cut -d':' -f2 | tr -d ' ' || true)
EXPIRES_IN=$(echo "$RESP" | grep -o '"expires_in":[^,}]*' | cut -d':' -f2 | tr -d ' ' || true)

if [ -z "$USER_CODE" ] || [ -z "$DEVICE_CODE" ]; then
  echo "⚠️ Google Device Auth Notice: Default Client ID requires your Google OAuth Client ID."
  echo ""
  read -p "Enter your Google OAuth Client ID (or press Enter for setup instructions): " USER_CLIENT_ID
  if [ -n "$USER_CLIENT_ID" ]; then
    CLIENT_ID="$USER_CLIENT_ID"
    RESP=$(curl -s -X POST "https://oauth2.googleapis.com/device/code" \
      -d "client_id=${CLIENT_ID}&scope=${SCOPE}")
    USER_CODE=$(echo "$RESP" | grep -o '"user_code":"[^"]*' | cut -d'"' -f4 || true)
    VERIFICATION_URL=$(echo "$RESP" | grep -o '"verification_url":"[^"]*' | cut -d'"' -f4 || true)
    DEVICE_CODE=$(echo "$RESP" | grep -o '"device_code":"[^"]*' | cut -d'"' -f4 || true)
  fi
fi

if [ -z "$USER_CODE" ] || [ -z "$DEVICE_CODE" ]; then
  echo "❌ Failed to retrieve Device Code from Google."
  echo "Response: $RESP"
  echo ""
  echo "💡 Alternative setup:"
  echo "You can also paste your Google Calendar Secret iCal URL (ICS) directly in the Dashboard Settings Modal!"
  exit 1
fi

if [ -z "$INTERVAL" ]; then INTERVAL=5; fi

echo ""
echo "------------------------------------------------------------------"
echo "🔑 AUTHENTICATION REQUIRED"
echo "------------------------------------------------------------------"
echo "1. On your phone, laptop, or tablet, open this URL:"
echo "   👉 ${VERIFICATION_URL:-https://www.google.com/device}"
echo ""
echo "2. Enter this code:"
echo "   👉  $USER_CODE"
echo "------------------------------------------------------------------"
echo ""
echo "⏳ Waiting for authorization... (Press Ctrl+C to cancel)"

# 2. Poll Token Endpoint until user completes auth on their device
TOKEN_RESP=""
ELAPSED=0
EXPIRES_IN=${EXPIRES_IN:-1800}

while [ $ELAPSED -lt $EXPIRES_IN ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  POLL_RES=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
    -d "client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&device_code=${DEVICE_CODE}&grant_type=urn:ietf:params:oauth:grant-type:device_code")

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

mkdir -p "$(dirname "$TOKEN_FILE")"
echo "$TOKEN_RESP" > "$TOKEN_FILE"

echo "=================================================================="
echo "✅ SUCCESS! GOOGLE CALENDAR AUTHENTICATED & PAIRED WITH ARES CITY OS"
echo "=================================================================="
echo "Saved credentials to: $TOKEN_FILE"
