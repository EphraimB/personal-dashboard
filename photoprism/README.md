# PhotoPrism Headless & TV Dashboard on Raspberry Pi

This directory contains a pre-configured Docker Compose setup for running [PhotoPrism](https://photoprism.app/) as a headless background service alongside a **TV Dashboard** inspired by the **Ares City OS theme** (`https://ephraimbecker.com/`).

---

## 📋 System Prerequisites

Before running PhotoPrism on a Raspberry Pi, ensure your host environment meets these crucial requirements:

1. **64-Bit Operating System:**
   * You **must** run a 64-bit OS (e.g., Raspberry Pi OS 64-bit, Ubuntu 64-bit). PhotoPrism's AI libraries and modern Go binaries do not run reliably on 32-bit platforms.
2. **Swap Space (4 GB minimum):**
   * Indexing photos is extremely memory-intensive. Running out of memory will crash the container.
   * To check your current swap space:
     ```bash
     swapon --show
     ```
   * To increase swap space to 4 GB on Raspberry Pi OS:
     1. Open `/etc/dphys-swapfile`: `sudo nano /etc/dphys-swapfile`
     2. Change `CONF_SWAPSIZE` to `4096`:
        ```text
        CONF_SWAPSIZE=4096
        ```
     3. Restart the swap service:
        ```bash
        sudo systemctl restart dphys-swapfile
        ```
3. **Storage (SSD Recommended):**
   * Running the metadata storage and cache from a standard MicroSD card will result in slow performance and can quickly wear out the card.
   * It is highly recommended to mount database, cache, and original photo directories on an **SSD** connected via USB 3.0.
   * Ensure that SQLite database files are **never** stored on network shares (NFS, SMB, etc.) as SQLite depends on POSIX file locking which network drives do not handle reliably.

---

## 🚀 Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```
2. **Configure environment variables:**
   Open the newly created `.env` file and edit the settings:
   * **Change the admin password:** Modify `PHOTOPRISM_ADMIN_PASSWORD` to a secure password (minimum 8 characters).
   * **Adjust paths:** Point `PHOTOPRISM_ORIGINALS_PATH` to your actual photos directory on the host (e.g., `/mnt/ssd/Pictures`).
   * **Configure workers:** Ensure `PHOTOPRISM_WORKERS` matches your Raspberry Pi model (default `2` is recommended for Pi 4/5).
3. **Start the services in headless (detached) mode:**
   ```bash
   docker compose up -d
   ```
4. **Access the Interfaces:**
   * **TV Dashboard (Ares City OS Theme):** `http://<your-raspberry-pi-ip>:8080`
   * **PhotoPrism Admin Console:** `http://<your-raspberry-pi-ip>:2342`

---

## 📺 Setting Up Chromium Kiosk Mode on your Pi TV

To automatically launch the TV Dashboard in full-screen Kiosk mode whenever your Raspberry Pi boots up and connects to your TV:

1. **Install Chromium & unclutter (to hide mouse cursor):**
   ```bash
   sudo apt update && sudo apt install -y chromium-browser unclutter
   ```
2. **Configure autostart script:**
   Create or edit `~/.config/openbox/autostart` or `/etc/xdg/lxsession/LXDE-pi/autostart`:
   ```bash
   # Hide mouse cursor after 3 seconds of inactivity
   unclutter -idle 3 &

   # Prevent screen sleeping/blanking
   xset s off
   xset -dpms
   xset s noblank

   # Launch Chromium in Kiosk mode pointing to the local dashboard container
   chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost:8080 &
   ```
3. **Reboot the Raspberry Pi:**
   ```bash
   sudo reboot
   ```

---

## 🎮 TV Dashboard Features & Keybindings

The TV Dashboard streams photos from PhotoPrism while automatically filtering out screenshots, AI-generated images, and documents.

* **Ken Burns Effect:** Smooth 15-second slow pan & zoom transition per photo asset.
* **Ares City HUD:** Displays real-time Earth Date, Local Time, and calculated Ares Sol Clock.
* **Smart Filter:** Excludes screenshots (`screenshot`, `screen_shot`), AI art (`midjourney`, `dall-e`, `stable_diffusion`), and text documents.

### Keybindings & Remote Shortcuts
| Key | Action |
| :--- | :--- |
| `◀` / `▶` | Skip to Previous / Next photo |
| `Space` / `Enter` | Pause / Play slideshow |
| `F` | Toggle Fullscreen mode |
| `S` | Toggle CRT Scanline HUD effect |
| `M` or `C` | Open / Close Configuration Modal |

---

## ⚙️ Performance Tuning

### SQLite vs. MariaDB
* **SQLite (Default):**
  * Recommended for Raspberry Pi 4 (2GB/4GB models) or libraries under 15,000 photos.
  * *Pros:* No extra container, lower memory/CPU overhead (saves ~300-500MB of RAM).
  * *Cons:* Less concurrent write performance.
* **MariaDB (Multi-user/Large collections):**
  * Recommended if you have a Raspberry Pi 4/5 (4GB/8GB models) with 20,000+ photos.
  * To enable:
    1. Open `compose.yaml` and uncomment the `mariadb` service block.
    2. Uncomment the `depends_on` block in the `photoprism` service.
    3. In your `.env` file, change:
       ```ini
       PHOTOPRISM_DATABASE_DRIVER=mysql
       ```
    4. Fill in the MariaDB connection credentials.

### CPU Worker Optimization
To prevent the Pi from freezing during indexing, limit worker threads:
* **Pi 4/5 (4GB/8GB RAM):** Use `PHOTOPRISM_WORKERS=2` (recommended).
* **Pi 3 or Pi 4 (2GB RAM):** Use `PHOTOPRISM_WORKERS=1` to prevent CPU lockups.

---

## 🛠️ CLI Operations Guide

### View Application Logs
```bash
docker compose logs -f
```

### Trigger Photo Indexing via CLI
```bash
docker compose exec photoprism photoprism index
```

### Reset Admin Password
```bash
docker compose exec photoprism photoprism passwd admin
```

### Stopping the Services
```bash
docker compose down
```
