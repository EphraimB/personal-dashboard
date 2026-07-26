# Ares City OS — Headless Microsoft OneDrive Integration Guide

This guide explains how to stream your photos directly from **Microsoft OneDrive** to your **Ares City OS TV Dashboard** on a Raspberry Pi over SSH without needing a monitor, keyboard, or mouse attached to the Pi.

---

## 🚀 Quick Setup (30 Seconds via SSH)

### Step 1: Open Terminal / SSH into your Raspberry Pi
```bash
ssh pi@your-raspberry-pi-ip
cd personal-dashboard
```

### Step 2: Run the Headless OneDrive Pairing Script
```bash
chmod +x ./scripts/onedrive-login.sh
./scripts/onedrive-login.sh
```

### Step 3: Authorize on Phone or Laptop
1. The terminal will display a verification URL and an 8-character code:
   ```text
   👉 URL: https://microsoft.com/devicelogin
   👉 Code: A1B2-C3D4
   ```
2. Open `https://microsoft.com/devicelogin` on your phone or laptop browser.
3. Enter the 8-character code and approve access to your OneDrive account.

### Step 4: Done! 🎉
The terminal script will automatically receive your authentication tokens and save them to `dashboard/onedrive_tokens.json`.

Your TV Dashboard will immediately start loading photos and full camera EXIF telemetry directly from your OneDrive!

---

## 📁 Customizing Target Photo Folders

By default, the dashboard streams all photos from your OneDrive **Photos** collection.

If you want to stream photos from a specific folder (e.g. `Pictures/Vacation` or `Pictures/Camera Roll`):
1. Open the TV Dashboard in your web browser from your phone/laptop: `http://<raspberry-pi-ip>`
2. Press `M` or click `[ ⚙ CONFIG ]`.
3. In the **Target Folder / Path** field, enter your folder relative to OneDrive root (e.g. `Pictures/Camera Roll`).
4. Click **SAVE & APPLY**.

---

## 🛠️ Security & Token Renewal

- Tokens are stored locally in `dashboard/onedrive_tokens.json` on your Pi.
- Access tokens automatically refresh using Microsoft OAuth2 refresh tokens without requiring re-authentication.
- If you ever need to revoke access, simply run `./scripts/onedrive-login.sh` again to pair a new session or revoke permission in your Microsoft Account security dashboard.
