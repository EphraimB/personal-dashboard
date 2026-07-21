# PhotoPrism Headless on Raspberry Pi

This directory contains a pre-configured Docker Compose setup for running [PhotoPrism](https://photoprism.app/) as a headless background service, optimized specifically for the Raspberry Pi.

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
3. **Start the service in headless (detached) mode:**
   ```bash
   docker compose up -d
   ```
4. **Access the Web Interface:**
   Open your browser and navigate to:
   ```text
   http://<your-raspberry-pi-ip>:2342
   ```
   Log in with the username `admin` and the password you set in `.env`.

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
To prevent the Pi from freezing during indexing, you must limit worker threads:
* **Pi 4/5 (4GB/8GB RAM):** Use `PHOTOPRISM_WORKERS=2` (recommended).
* **Pi 3 or Pi 4 (2GB RAM):** Use `PHOTOPRISM_WORKERS=1` to prevent CPU lockups.

### Disable CPU-Heavy AI Features
If indexing is too slow or consumes too much memory, you can disable faces and image classification features in your `.env` file:
```ini
PHOTOPRISM_DISABLE_FACES=true
PHOTOPRISM_DISABLE_CLASSIFICATION=true
```

---

## 🛠️ CLI Operations Guide

Since this container runs headlessly, management tasks are done using the Docker command line:

### View Application Logs
To monitor what the indexer is doing or troubleshoot issues:
```bash
docker compose logs -f photoprism
```

### Trigger Photo Indexing via CLI
While indexing can be triggered from the web UI, you can also run it directly in the background:
```bash
docker compose exec photoprism photoprism index
```

### Reset Admin Password
If you forget your administrator password and cannot log in:
```bash
docker compose exec photoprism photoprism passwd admin
```

### Create a Database Backup
To backup your SQLite or MariaDB database metadata:
```bash
docker compose exec photoprism photoprism backup
```
The backup file will be created in your configured backup directory (defaults to `./backup`).

### Stopping the Container
To stop all PhotoPrism services:
```bash
docker compose down
```
To stop the services and delete the container images/volumes (retaining your photos/database data):
```bash
docker compose down -v
```
