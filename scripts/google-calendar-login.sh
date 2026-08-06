#!/usr/bin/env bash
# ==============================================================================
# ARES CITY OS — HEADLESS GOOGLE CALENDAR AUTHENTICATION SCRIPT FOR RASPBERRY PI
# ==============================================================================

set -e

ICAL_FILE="$(dirname "$0")/../dashboard/google_calendar_ical.json"
TOKEN_FILE="$(dirname "$0")/../dashboard/google_calendar_tokens.json"

echo "=================================================================="
echo "⚡ ARES CITY OS — GOOGLE CALENDAR SETUP (RASPBERRY PI)"
echo "=================================================================="
echo ""
echo "How would you like to pair your Google Calendar?"
echo "  [1] Google Calendar iCal / ICS Feed URL (RECOMMENDED — Fast 10-second setup, no Google Cloud setup needed)"
echo "  [2] Google OAuth 2.0 Device Code Authorization (Requires custom Google Cloud Client ID)"
echo ""
read -p "Select option [1 or 2]: " SETUP_CHOICE

if [ "$SETUP_CHOICE" = "1" ] || [ -z "$SETUP_CHOICE" ]; then
  echo ""
  echo "------------------------------------------------------------------"
  echo "📋 GOOGLE CALENDAR iCAL SETUP (10 SECONDS)"
  echo "------------------------------------------------------------------"
  echo "1. On your phone, laptop, or computer, open Google Calendar:"
  echo "   👉 https://calendar.google.com"
  echo ""
  echo "2. Click the ⚙ Settings icon at top right -> Settings for your calendar."
  echo "3. Scroll down to 'Integrate calendar' and copy:"
  echo "   👉 'Secret address in iCal format' (ends with .ics)"
  echo "------------------------------------------------------------------"
  echo ""
  read -p "Paste your iCal Secret Feed URL (.ics): " ICAL_URL

  if [ -z "$ICAL_URL" ]; then
    echo "❌ No URL provided. Cancelled."
    exit 1
  fi

  mkdir -p "$(dirname "$ICAL_FILE")"
  echo "{\"icalUrl\": \"$ICAL_URL\"}" > "$ICAL_FILE"

  echo ""
  echo "=================================================================="
  echo "✅ SUCCESS! GOOGLE CALENDAR iCAL FEED PAIRED WITH ARES CITY OS"
  echo "=================================================================="
  echo "Saved configuration to: $ICAL_FILE"
  echo "Your TV Dashboard will now automatically sync your Google Calendar events live!"
  exit 0
fi

# Option 2: Google OAuth Device Flow
echo ""
echo "------------------------------------------------------------------"
echo "🔑 GOOGLE OAUTH 2.0 DEVICE FLOW"
echo "------------------------------------------------------------------"
read -p "Enter your Google OAuth Client ID: " CLIENT_ID
read -p "Enter your Google OAuth Client Secret (optional/press Enter if public client): " CLIENT_SECRET

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Client ID is required for Google OAuth Device Flow."
  exit 1
fi

SCOPE="https://www.googleapis.com/auth/calendar.readonly"

echo "📡 Requesting Device Code from Google..."
RESP=$(curl -s -X POST "https://oauth2.googleapis.com/device/code" \
  -d "client_id=${CLIENT_ID}&scope=${SCOPE}")

USER_CODE=$(echo "$RESP" | grep -o '"user_code":"[^"]*' | cut -d'"' -f4 || true)
VERIFICATION_URL=$(echo "$RESP" | grep -o '"verification_url":"[^"]*' | cut -d'"' -f4 || true)
DEVICE_CODE=$(echo "$RESP" | grep -o '"device_code":"[^"]*' | cut -d'"' -f4 || true)
INTERVAL=$(echo "$RESP" | grep -o '"interval":[^,}]*' | cut -d':' -f2 | tr -d ' ' || true)
EXPIRES_IN=$(echo "$RESP" | grep -o '"expires_in":[^,}]*' | cut -d':' -f2 | tr -d ' ' || true)

if [ -z "$USER_CODE" ] || [ -z "$DEVICE_CODE" ]; then
  echo "❌ Failed to retrieve Device Code from Google."
  echo "Response: $RESP"
  exit 1
fi

if [ -z "$INTERVAL" ]; then INTERVAL=5; fi

echo ""
echo "------------------------------------------------------------------"
echo "🔑 GOOGLE AUTHENTICATION REQUIRED"
echo "------------------------------------------------------------------"
echo "1. On your phone, laptop, or tablet, open this URL:"
echo "   👉 ${VERIFICATION_URL:-https://www.google.com/device}"
echo ""
echo "2. Enter this code:"
echo "   👉  $USER_CODE"
echo "------------------------------------------------------------------"
echo ""
echo "⏳ Waiting for authorization... (Press Ctrl+C to cancel)"

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
