# Ares City OS — Next.js TV Dashboard & OneDrive Photo Stream

A high-performance, sci-fi TV Dashboard built with **Next.js 14**, **React**, and **Microsoft OneDrive Graph API**. 

Designed specifically for **Raspberry Pi** and smart TV displays without requiring Docker.

---

## ⚡ Quick Start (No Docker Needed!)

### Step 1: Clone & Install Dependencies
```bash
cd personal-dashboard
npm install
```

### Step 2: Pair OneDrive Account over SSH
Run the device code authentication script in your SSH terminal:
```bash
npm run login
```
*(Or `./scripts/onedrive-login.sh`)*

1. Open `https://microsoft.com/devicelogin` on your phone or laptop.
2. Enter the **8-character code** printed in your terminal.
3. Click **Approve**.

### Step 3: Launch Next.js App

- **Development Mode**:
  ```bash
  npm run dev
  ```
  App will start on `http://localhost:3000` (or `http://<raspberry-pi-ip>:3000`).

- **Production Mode**:
  ```bash
  npm run build
  npm start
  ```

---

## 🛠️ Running Automatically on Boot (Systemd)

To make Next.js run automatically whenever your Raspberry Pi turns on:

1. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/tv-dashboard.service
   ```

2. Paste the following configuration:
   ```ini
   [Unit]
   Description=Next.js TV Dashboard Service
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/Documents/personal-dashboard
   ExecStart=/usr/bin/npm start
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable tv-dashboard.service
   sudo systemctl start tv-dashboard.service
   ```

Now your TV Dashboard will start automatically on boot and stream your OneDrive photos!
