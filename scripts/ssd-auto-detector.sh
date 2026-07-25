#!/usr/bin/env bash
# ==============================================================================
# Plug & Play External SSD Auto-Detector & Photo Prism Auto-Indexer
# ==============================================================================
# Detects connected external USB SSD drives, auto-mounts them, syncs/symlinks
# photo collections to PhotoPrism's originals folder, and triggers API re-indexing.
# ==============================================================================

MOUNT_BASE="${MOUNT_BASE:-/media/external_ssd}"
PHOTOPRISM_URL="${PHOTOPRISM_URL:-http://localhost:2342}"
ORIGINALS_PATH="${PHOTOPRISM_ORIGINALS_PATH:-/photoprism/originals}"
STATUS_FILE="${STATUS_FILE:-/tmp/ssd_status.json}"

# Ensure status directory exists
mkdir -p "$(dirname "$STATUS_FILE")"
mkdir -p "$MOUNT_BASE"

update_status() {
  local state="$1"
  local dev="$2"
  local photos="$3"
  local msg="$4"
  cat <<EOF > "$STATUS_FILE"
{
  "status": "$state",
  "device": "$dev",
  "photosFound": $photos,
  "message": "$msg",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

trigger_photoprism_index() {
  echo "[SSD Detector] Triggering PhotoPrism Auto-Index via REST API..."
  # Try triggering via HTTP API
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PHOTOPRISM_URL}/api/v1/index" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo "[SSD Detector] PhotoPrism index triggered successfully (HTTP $HTTP_CODE)."
  else
    # Fallback to docker compose exec if running on host
    if command -v docker >/dev/null 2>&1; then
      echo "[SSD Detector] API call returned $HTTP_CODE. Attempting Docker CLI indexing fallback..."
      docker exec photoprism photoprism index --all >/dev/null 2>&1 &
    fi
  fi
}

scan_and_index_drive() {
  local mount_dir="$1"
  local dev_name="$2"

  echo "[SSD Detector] Scanning mounted storage at $mount_dir for photo media..."
  update_status "SCANNING" "$dev_name" 0 "Scanning drive for photos..."

  # Find photo media extensions
  IMAGE_COUNT=$(find "$mount_dir" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.heic" -o -iname "*.webp" -o -iname "*.cr2" -o -iname "*.nef" -o -iname "*.arw" -o -iname "*.dng" \) 2>/dev/null | wc -l)

  echo "[SSD Detector] Discovered $IMAGE_COUNT photo files on external storage."

  if [ "$IMAGE_COUNT" -gt 0 ]; then
    # Create symlink or subfolder in originals path if originals path exists
    if [ -d "$ORIGINALS_PATH" ]; then
      TARGET_LINK="$ORIGINALS_PATH/External_SSD"
      echo "[SSD Detector] Symlinking $mount_dir to $TARGET_LINK..."
      ln -sfn "$mount_dir" "$TARGET_LINK" 2>/dev/null || cp -rs "$mount_dir"/* "$ORIGINALS_PATH/" 2>/dev/null || true
    fi

    update_status "CONNECTED" "$dev_name" "$IMAGE_COUNT" "Plug & Play SSD active with $IMAGE_COUNT photos."
    trigger_photoprism_index
  else
    update_status "CONNECTED_EMPTY" "$dev_name" 0 "SSD mounted but no image files found."
  fi
}

mount_device() {
  local dev="$1"
  if [ -z "$dev" ]; then return 1; fi

  echo "[SSD Detector] Processing plug event for device $dev..."
  
  # Determine target mount point
  MNT_POINT="$MOUNT_BASE/$(basename "$dev")"
  mkdir -p "$MNT_POINT"

  # Check if already mounted
  if mountpoint -q "$MNT_POINT" || grep -q "$dev" /proc/mounts; then
    MNT_POINT=$(grep "$dev" /proc/mounts | awk '{print $2}' | head -n 1)
    echo "[SSD Detector] Device $dev is already mounted at $MNT_POINT"
  else
    echo "[SSD Detector] Mounting $dev to $MNT_POINT..."
    mount -o defaults,noatime,uid=1000,gid=1000 "$dev" "$MNT_POINT" 2>/dev/null || \
    udisksctl mount -b "$dev" --no-user-interaction 2>/dev/null || \
    mount "$dev" "$MNT_POINT" 2>/dev/null || true
  fi

  if mountpoint -q "$MNT_POINT" || grep -q "$dev" /proc/mounts; then
    scan_and_index_drive "$MNT_POINT" "$dev"
  else
    update_status "ERROR" "$dev" 0 "Failed to mount device $dev"
  fi
}

unmount_device() {
  local dev="$1"
  echo "[SSD Detector] Processing unplug event for device $dev..."
  MNT_POINT="$MOUNT_BASE/$(basename "$dev")"

  if [ -d "$ORIGINALS_PATH/External_SSD" ]; then
    rm -f "$ORIGINALS_PATH/External_SSD" 2>/dev/null || true
  fi

  umount "$dev" 2>/dev/null || umount -l "$MNT_POINT" 2>/dev/null || true
  update_status "DISCONNECTED" "NONE" 0 "External SSD unplugged."
  echo "[SSD Detector] SSD unplugged cleanly."
}

daemon_loop() {
  echo "[SSD Detector] Running continuous Plug & Play USB monitoring loop..."
  update_status "DISCONNECTED" "NONE" 0 "Waiting for external SSD connection..."

  LAST_DEV=""
  while true; do
    # Scan for external USB block storage devices
    CURRENT_DEV=$(lsblk -d -n -o NAME,TRAN,TYPE | grep "usb" | grep "disk" | awk '{print "/dev/"$1}' | head -n 1)
    
    # Also check partition if disk found
    if [ -n "$CURRENT_DEV" ]; then
      PARTITION=$(lsblk -n -o NAME,TYPE "$CURRENT_DEV" | grep "part" | awk '{print "/dev/"$1}' | head -n 1)
      if [ -n "$PARTITION" ]; then
        CURRENT_DEV="$PARTITION"
      fi
    fi

    if [ -n "$CURRENT_DEV" ] && [ "$CURRENT_DEV" != "$LAST_DEV" ]; then
      echo "[SSD Detector] New external SSD detected: $CURRENT_DEV"
      mount_device "$CURRENT_DEV"
      LAST_DEV="$CURRENT_DEV"
    elif [ -z "$CURRENT_DEV" ] && [ -n "$LAST_DEV" ]; then
      echo "[SSD Detector] External SSD disconnected."
      unmount_device "$LAST_DEV"
      LAST_DEV=""
    fi

    sleep 5
  done
}

# Entrypoint routing based on action
CMD="${1:-daemon}"
DEV_PATH="$2"

case "$CMD" in
  mount)
    mount_device "$DEV_PATH"
    ;;
  unmount)
    unmount_device "$DEV_PATH"
    ;;
  daemon)
    daemon_loop
    ;;
  *)
    echo "Usage: $0 {mount <dev>|unmount <dev>|daemon}"
    exit 1
    ;;
esac
