#!/usr/bin/env bash
# ==============================================================================
# ARES CITY OS — RASPBERRY PI CHROMIUM KIOSK AUTOSTART SETUP
# ==============================================================================
# This script configures Chromium to automatically launch on boot in full-screen
# kiosk mode pointing to http://localhost:3000 on Raspberry Pi OS, plus unclutter.
# ==============================================================================

set -e

DASHBOARD_URL="http://localhost:3000"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/tv-dashboard-kiosk.desktop"
UNCLUTTER_FILE="$AUTOSTART_DIR/unclutter.desktop"

echo "=================================================================="
echo "📺 ARES CITY OS — CHROMIUM KIOSK & UNCLUTTER AUTOSTART SETUP"
echo "=================================================================="
echo ""

mkdir -p "$AUTOSTART_DIR"

echo "⚙️ Creating Autostart Desktop Entry ($DESKTOP_FILE)..."
cat <<EOF > "$DESKTOP_FILE"
[Desktop Entry]
Type=Application
Name=Ares City TV Dashboard Kiosk
Comment=Autostart Chromium in Fullscreen Kiosk Mode on Boot
Exec=chromium --enable-features=UseOzonePlatform --ozone-platform=wayland --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --password-store=basic --noerrdialogs --disable-infobar --kiosk $DASHBOARD_URL
X-GNOME-Autostart-enabled=true
EOF
chmod +x "$DESKTOP_FILE"

echo "⚙️ Creating Unclutter Autostart Entry ($UNCLUTTER_FILE)..."
cat <<EOF > "$UNCLUTTER_FILE"
[Desktop Entry]
Type=Application
Name=Unclutter Hide Mouse Cursor
Comment=Hide mouse cursor when idle
Exec=unclutter -idle 0.5 -root
X-GNOME-Autostart-enabled=true
EOF
chmod +x "$UNCLUTTER_FILE"

# Also configure LXDE autostart if using X11 (Legacy Pi OS)
LXDE_AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"
if [ -d "$(dirname "$LXDE_AUTOSTART")" ]; then
  echo "⚙️ Configuring LXDE autostart..."
  if ! grep -q "chromium.*kiosk" "$LXDE_AUTOSTART" 2>/dev/null; then
    echo "@xset s off" >> "$LXDE_AUTOSTART"
    echo "@xset -dpms" >> "$LXDE_AUTOSTART"
    echo "@xset s noblank" >> "$LXDE_AUTOSTART"
    echo "@unclutter -idle 0.5 -root" >> "$LXDE_AUTOSTART"
    echo "@chromium --enable-features=UseOzonePlatform --ozone-platform=wayland --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --password-store=basic --noerrdialogs --disable-infobar --kiosk $DASHBOARD_URL" >> "$LXDE_AUTOSTART"
  fi
fi

# Configure Wayfire autostart if using Wayfire (Raspberry Pi OS Bookworm)
WAYFIRE_CONFIG="$HOME/.config/wayfire.ini"
if [ -f "$WAYFIRE_CONFIG" ]; then
  echo "⚙️ Adding Chromium Kiosk & Unclutter to wayfire.ini..."
  if ! grep -q "kiosk = chromium" "$WAYFIRE_CONFIG"; then
    cat <<EOF >> "$WAYFIRE_CONFIG"

[autostart]
unclutter = unclutter -idle 0.5 -root
kiosk = chromium --enable-features=UseOzonePlatform --ozone-platform=wayland --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --password-store=basic --noerrdialogs --disable-infobar --kiosk $DASHBOARD_URL
EOF
  fi
fi

echo ""
echo "=================================================================="
echo "✅ SUCCESS! CHROMIUM KIOSK & UNCLUTTER AUTOSTART CONFIGURED"
echo "=================================================================="
echo "Chromium will launch in Wayland Kiosk mode pointing to:"
echo "👉 $DASHBOARD_URL"
echo "Mouse cursor will automatically hide after 0.5 seconds of inactivity."
