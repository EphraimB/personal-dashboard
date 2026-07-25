#!/usr/bin/env bash
# ==============================================================================
# Plug & Play External SSD Automount & Setup Script for Raspberry Pi / Linux
# ==============================================================================
# This script configures Linux (udev & udisks2 / systemd) to automatically 
# mount any connected USB external SSD / flash drive and notify PhotoPrism.
# ==============================================================================

set -e

echo "------------------------------------------------------------------"
echo "🚀 Initializing Plug & Play External SSD Setup for PhotoPrism"
echo "------------------------------------------------------------------"

# Ensure running with root / sudo permissions
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script with sudo or as root: sudo ./setup-plug-and-play.sh"
  exit 1
fi

# 1. Install necessary automount tools (udisks2, ntfs-3g, exfat-fuse)
echo "📦 Installing file system utilities and udisks2..."
apt-get update -qq
for pkg in udisks2 ntfs-3g exfat-fuse curl inotify-tools hfsplus; do
  apt-get install -y -qq "$pkg" > /dev/null 2>&1 || true
done

# 2. Create standard mount point directories
MOUNT_BASE="/media/external_ssd"
mkdir -p "$MOUNT_BASE"
chmod 777 "$MOUNT_BASE"

# 3. Create udev rule for hotplug detection of USB block storage devices
UDEV_RULE_PATH="/etc/udev/rules.d/99-external-ssd-automount.rules"
echo "⚙️ Creating udev rule for USB SSD auto-detection ($UDEV_RULE_PATH)..."

cat <<'EOF' > "$UDEV_RULE_PATH"
# Auto-mount USB SSD / Flash drives upon insertion and trigger PhotoPrism auto-index
ACTION=="add", KERNEL=="sd[a-z][0-9]", SUBSYSTEM=="block", ENV{ID_BUS}=="usb", RUN+="/usr/local/bin/ssd-auto-detector.sh mount /dev/%k"
ACTION=="remove", KERNEL=="sd[a-z][0-9]", SUBSYSTEM=="block", ENV{ID_BUS}=="usb", RUN+="/usr/local/bin/ssd-auto-detector.sh unmount /dev/%k"
EOF

udevadm control --reload-rules || true
udevadm trigger || true

# 4. Copy auto-detector script to system bin
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR_SCRIPT="$SCRIPT_DIR/ssd-auto-detector.sh"

if [ -f "$DETECTOR_SCRIPT" ]; then
  cp "$DETECTOR_SCRIPT" /usr/local/bin/ssd-auto-detector.sh
  chmod +x /usr/local/bin/ssd-auto-detector.sh
  echo "✅ Installed /usr/local/bin/ssd-auto-detector.sh"
else
  echo "⚠️ Warning: $DETECTOR_SCRIPT not found in current directory. Make sure to place it in /usr/local/bin/ssd-auto-detector.sh"
fi

# 5. Install background Systemd Daemon for polling fallback
SERVICE_FILE="$SCRIPT_DIR/ssd-automount.service"
if [ -f "$SERVICE_FILE" ]; then
  cp "$SERVICE_FILE" /etc/systemd/system/ssd-automount.service
  systemctl daemon-reload
  systemctl enable ssd-automount.service
  systemctl restart ssd-automount.service || true
  echo "✅ Enabled and started ssd-automount.service daemon"
fi

# 6. Ensure photoprism/.env exists
ENV_FILE="$SCRIPT_DIR/../photoprism/.env"
ENV_EXAMPLE="$SCRIPT_DIR/../photoprism/.env.example"
if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
  echo "📝 Creating photoprism/.env from template..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# Detect exact USB SSD partition mount point (e.g. /media/external_ssd/sda1)
EXISTING_MOUNT=$(grep -E "/media/external_ssd/|/media/pi/|/mnt/" /proc/mounts | awk '{print $2}' | grep -E "sd[a-z][0-9]" | head -n 1)
if [ -z "$EXISTING_MOUNT" ]; then
  EXISTING_MOUNT=$(ls -d /media/external_ssd/sd* 2>/dev/null | head -n 1)
fi
if [ -z "$EXISTING_MOUNT" ]; then
  EXISTING_MOUNT="/media/external_ssd/sda1"
fi

if [ -f "$ENV_FILE" ]; then
  echo "📌 Pointing PhotoPrism originals path to exact SSD partition: $EXISTING_MOUNT"
  sed -i "s|^PHOTOPRISM_ORIGINALS_PATH=.*|PHOTOPRISM_ORIGINALS_PATH=$EXISTING_MOUNT|" "$ENV_FILE"
fi

# 7. Trigger immediate scan of existing mounted drives
echo "🔍 Triggering initial scan of connected drives..."
/usr/local/bin/ssd-auto-detector.sh mount /dev/sda1 2>/dev/null || /usr/local/bin/ssd-auto-detector.sh mount /dev/sdb1 2>/dev/null || true

echo "------------------------------------------------------------------"
echo "✨ Plug & Play Setup Complete!"
echo "📌 External USB SSDs will now auto-mount to $MOUNT_BASE"
echo "📌 PhotoPrism will automatically scan and stream photos upon insertion."
echo "------------------------------------------------------------------"
