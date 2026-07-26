#!/usr/bin/env bash
# ==============================================================================
# Automatic SSD Mount & Auto-Detection Daemon Script
# ==============================================================================

ACTION="$1"
DEVICE="$2"
MOUNT_BASE="/media/external_ssd"

mkdir -p "$MOUNT_BASE"

if [ "$ACTION" = "mount" ] && [ -n "$DEVICE" ]; then
  DEV_NAME=$(basename "$DEVICE")
  TARGET="$MOUNT_BASE/$DEV_NAME"
  mkdir -p "$TARGET"
  mount "$DEVICE" "$TARGET" 2>/dev/null || mount -t exfat "$DEVICE" "$TARGET" 2>/dev/null || true
  chmod -R 777 "$TARGET" 2>/dev/null || true
  echo "[SSD Auto-Detector] Mounted $DEVICE at $TARGET"
elif [ "$ACTION" = "unmount" ] && [ -n "$DEVICE" ]; then
  DEV_NAME=$(basename "$DEVICE")
  TARGET="$MOUNT_BASE/$DEV_NAME"
  umount -l "$TARGET" 2>/dev/null || true
  rmdir "$TARGET" 2>/dev/null || true
  echo "[SSD Auto-Detector] Unmounted $DEVICE"
fi
