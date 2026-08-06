/* ==============================================================================
   ARES CITY OS — TV DASHBOARD & ONEDRIVE PHOTO STREAM ENGINE
   ============================================================================== */

(function () {
  'use strict';

  // --- Configuration Management ---
  const STORAGE_KEY = 'ares_tv_dashboard_config';

  const DEFAULT_CONFIG = {
    onedriveToken: '',
    onedriveFolder: '',
    filterScreenshots: true,
    albumQuery: '',
    slideDuration: 15, // seconds
    enableKenBurns: true,
    enableScanlines: true,
    enableFallbackDemo: true
  };

  let config = loadConfig();

  // --- High-Resolution Fallback Demo Photos ---
  const DEMO_PHOTOS = [
    {
      id: 'demo-1',
      title: 'Ares Habitat Surface Survey',
      date: '2026-07-21 18:45',
      location: 'Ares Crater, Mars System',
      camera: 'Ares Rover Optical Cam 4K',
      exif: '24mm • f/4.0 • 1/1000s • ISO 100',
      url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2000&auto=format&fit=crop'
    },
    {
      id: 'demo-2',
      title: 'Nebula Horizon Over City',
      date: '2026-06-15 22:10',
      location: 'Citizen Suite Penthouse',
      camera: 'Sony Alpha A7 IV',
      exif: '35mm • f/1.8 • 1/60s • ISO 800',
      url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop'
    },
    {
      id: 'demo-3',
      title: 'Pressurized Mountain Pass',
      date: '2026-05-04 11:30',
      location: 'Sector 02 Alpine Loop',
      camera: 'Fujifilm X-T5',
      exif: '16mm • f/8.0 • 1/250s • ISO 200',
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
    },
    {
      id: 'demo-4',
      title: 'Cosmic Reflection Lake',
      date: '2026-04-12 05:20',
      location: 'Northern Colony Sanctuary',
      camera: 'Canon EOS R5',
      exif: '50mm • f/1.4 • 1/4000s • ISO 100',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop'
    },
    {
      id: 'demo-5',
      title: 'Deep Space Orbital Aurora',
      date: '2026-03-29 02:15',
      location: 'Ares City Orbital Platform',
      camera: 'Orbital Tele-Array Mark III',
      exif: '85mm • f/1.2 • 1/30s • ISO 1600',
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000&auto=format&fit=crop'
    }
  ];

  // --- Application State ---
  let photoList = [];
  let currentIndex = 0;
  let isPaused = false;
  let slideTimer = null;
  let progressInterval = null;
  let slideStartTime = 0;
  let activeLayer = 1;
  let isConnectedToOneDrive = false;

  // --- DOM Elements ---
  const elViewport = document.getElementById('slideshow-viewport');
  const elLayer1 = document.getElementById('bg-layer-1');
  const elLayer2 = document.getElementById('bg-layer-2');
  const elScanline = document.getElementById('hud-scanline');
  
  const elClockTime = document.getElementById('clock-time');
  const elClockAmPm = document.getElementById('clock-ampm');
  const elClockDate = document.getElementById('clock-date');
  const elAresSol = document.getElementById('ares-sol-text');
  
  const elSysStatusText = document.getElementById('sys-status-text');
  const elStatusPill = document.querySelector('.status-pill');
  const elPhotoCounter = document.getElementById('photo-index-counter');
  const elSourceBadge = document.getElementById('source-badge');
  const elSsdBadge = document.getElementById('ssd-status-badge');

  const elPhotoTitle = document.getElementById('photo-title');
  const elMetaDate = document.getElementById('meta-date');
  const elMetaLocation = document.getElementById('meta-location');
  const elMetaCamera = document.getElementById('meta-camera');
  const elMetaExif = document.getElementById('meta-exif');
  const elProgressBar = document.getElementById('slide-progress');

  // Controls
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnPause = document.getElementById('btn-pause');
  const btnScanline = document.getElementById('btn-scanline');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  // Modal Settings
  const modalSettings = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const elTestResult = document.getElementById('connection-test-result');

  const inputToken = document.getElementById('cfg-onedrive-token');
  const inputFolder = document.getElementById('cfg-onedrive-folder');
  const chkFilterScreenshots = document.getElementById('cfg-filter-screenshots');
  const inputAlbumQuery = document.getElementById('cfg-album-query');
  const inputSlideDuration = document.getElementById('cfg-slide-duration');
  const chkKenBurns = document.getElementById('cfg-enable-kenburns');
  const chkScanlines = document.getElementById('cfg-enable-scanlines');
  const chkFallbackDemo = document.getElementById('cfg-fallback-demo');

  // --- Initialization ---
  function init() {
    applyConfigUI();
    updateClock();
    setInterval(updateClock, 1000);

    setupEventListeners();
    fetchPhotosAndStart();
    startOneDrivePolling();
  }

  function startOneDrivePolling() {
    // Poll every 30 seconds for new OneDrive photo uploads / sync
    setInterval(async () => {
      const result = await fetchFromOneDrive();
      if (result.success && result.photos && result.photos.length > 0) {
        if (!isConnectedToOneDrive || photoList === DEMO_PHOTOS) {
          photoList = result.photos;
          isConnectedToOneDrive = true;
          elSourceBadge.textContent = 'ONEDRIVE';
          elSourceBadge.className = 'stat-value source-connected';
          setSystemStatus(`ONLINE (${photoList.length} PHOTOS)`, true);
          if (elSsdBadge) {
            elSsdBadge.textContent = 'PAIRED';
            elSsdBadge.className = 'stat-value ssd-connected';
          }
          currentIndex = 0;
          showPhoto(0);
        } else if (result.photos.length !== photoList.length) {
          console.log(`[OneDrive Sync] Library updated! New count: ${result.photos.length}`);
          photoList = result.photos;
          setSystemStatus(`ONLINE (${photoList.length} PHOTOS)`, true);
        }
      } else if (!isConnectedToOneDrive && elSsdBadge) {
        elSsdBadge.textContent = 'SSH AUTH';
        elSsdBadge.className = 'stat-value ssd-idle';
      }
    }, 30000);
  }

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
      return { ...DEFAULT_CONFIG };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config', e);
    }
  }

  function applyConfigUI() {
    inputToken.value = config.onedriveToken;
    inputFolder.value = config.onedriveFolder;
    chkFilterScreenshots.checked = config.filterScreenshots;
    inputAlbumQuery.value = config.albumQuery;
    inputSlideDuration.value = config.slideDuration;
    chkKenBurns.checked = config.enableKenBurns;
    chkScanlines.checked = config.enableScanlines;
    chkFallbackDemo.checked = config.enableFallbackDemo;

    if (config.enableScanlines) {
      elScanline.classList.remove('disabled');
    } else {
      elScanline.classList.add('disabled');
    }
  }

  // --- Real-time Clock ---
  function updateClock() {
    const now = new Date();
    
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(now.getMinutes()).padStart(2, '0');
    const sStr = String(now.getSeconds()).padStart(2, '0');

    elClockTime.textContent = `${hStr}:${mStr}:${sStr}`;
    elClockAmPm.textContent = ampm;

    const options = { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' };
    elClockDate.textContent = now.toLocaleDateString('en-US', options).toUpperCase();

    const julianDate = (now.getTime() / 86400000) + 2440587.5;
    const msd = (julianDate - 2451549.5) / 1.027491252 + 44796.0;
    elAresSol.textContent = `ARES SOL: ${msd.toFixed(3)}`;
  }

  // --- Microsoft Graph API & Token Handler ---
  async function loadTokensFromFile() {
    try {
      const res = await fetch('onedrive_tokens.json');
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          return data;
        }
      }
    } catch (e) {
      // File not present or running standalone
    }
    return null;
  }

  let activeTenant = 'consumers';

  async function refreshOneDriveAccessToken(refreshToken, clientId, tenant) {
    try {
      const cId = clientId || '14d82eec-204b-4c2f-b7e8-296a70dab67e';
      const t = tenant || activeTenant || 'consumers';
      const params = new URLSearchParams();
      params.append('client_id', cId);
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);

      const res = await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (res.ok) {
        const data = await res.json();
        return data.access_token || '';
      }
    } catch (e) {
      console.warn('[OneDrive] Refresh token failed:', e);
    }
    return '';
  }

  async function fetchPhotosAndStart() {
    setSystemStatus('CONNECTING TO ONEDRIVE...', false);
    photoList = [];

    const result = await fetchFromOneDrive();

    if (result.success && result.photos && result.photos.length > 0) {
      photoList = result.photos;
      isConnectedToOneDrive = true;
      elSourceBadge.textContent = 'ONEDRIVE';
      elSourceBadge.className = 'stat-value source-connected';
      setSystemStatus(`ONLINE (${photoList.length} PHOTOS)`, true);
      if (elSsdBadge) {
        elSsdBadge.textContent = 'PAIRED';
        elSsdBadge.className = 'stat-value ssd-connected';
      }
    } else if (config.enableFallbackDemo) {
      photoList = DEMO_PHOTOS;
      isConnectedToOneDrive = false;
      elSourceBadge.textContent = 'DEMO STREAM';
      elSourceBadge.className = 'stat-value';
      setSystemStatus(`DEMO MODE (${result.reason || 'NOT CONNECTED'})`, false);
      if (elSsdBadge) {
        elSsdBadge.textContent = 'SSH AUTH';
        elSsdBadge.className = 'stat-value ssd-idle';
      }
    } else {
      setSystemStatus(`ERROR: ${result.reason || 'NO PHOTOS'}`, false);
      elPhotoTitle.textContent = result.reason || 'No photos available';
      return;
    }

    currentIndex = 0;
    showPhoto(currentIndex);
    startSlideshowTimer();
  }

  async function fetchFromOneDrive() {
    let token = config.onedriveToken.trim();
    let refreshToken = '';
    let clientId = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
    let tenant = 'consumers';

    // Check local token file created by ./scripts/onedrive-login.sh over SSH
    const localTokens = await loadTokensFromFile();
    if (localTokens) {
      if (localTokens.access_token) token = localTokens.access_token;
      if (localTokens.refresh_token) refreshToken = localTokens.refresh_token;
      if (localTokens.client_id) clientId = localTokens.client_id;
      if (localTokens.tenant) tenant = localTokens.tenant;
    }
    activeTenant = tenant;

    if (!token && !refreshToken) {
      return { success: false, reason: 'No OneDrive credentials found. Run ./scripts/onedrive-login.sh over SSH' };
    }

    let res = await tryFetchGraphPhotos(token);
    if (!res.success && refreshToken) {
      console.log('[OneDrive] Attempting refresh token...');
      const newToken = await refreshOneDriveAccessToken(refreshToken, clientId);
      if (newToken) {
        token = newToken;
        res = await tryFetchGraphPhotos(newToken);
      }
    }

    return res;
  }

  async function tryFetchGraphPhotos(accessToken) {
    try {
      let endpoint = 'https://graph.microsoft.com/v1.0/me/drive/special/photos/children?$expand=thumbnails&$top=500';

      const targetFolder = config.onedriveFolder.trim();
      if (targetFolder) {
        const cleanPath = targetFolder.replace(/^\/+|\/+$/g, '');
        endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanPath)}:/children?$expand=thumbnails&$top=500`;
      } else if (config.albumQuery.trim()) {
        endpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(config.albumQuery.trim())}')?$expand=thumbnails&$top=500`;
      }

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.status === 401 || response.status === 403) {
        return { success: false, reason: 'OneDrive Access Token Expired. Run ./scripts/onedrive-login.sh' };
      }

      if (!response.ok) {
        return { success: false, reason: `Microsoft Graph API Error HTTP ${response.status}` };
      }

      const data = await response.json();
      const items = data.value || [];

      if (items.length === 0) {
        return { success: false, reason: '0 Photos found in specified OneDrive location' };
      }

      // Filter images
      const imageItems = items.filter(item => {
        if (!item.file) return false;
        const mime = item.file.mimeType || '';
        if (!mime.startsWith('image/')) return false;
        if (config.filterScreenshots && !isRealCameraPhoto(item)) return false;
        return true;
      });

      const itemsToUse = imageItems.length > 0 ? imageItems : items.filter(i => i.file && (i.file.mimeType || '').startsWith('image/'));

      if (itemsToUse.length === 0) {
        return { success: false, reason: 'No photo files matching criteria' };
      }

      const transformed = itemsToUse.map(item => transformOneDriveItem(item));
      return { success: true, photos: transformed };
    } catch (e) {
      console.warn('[OneDrive] Graph API fetch error:', e);
      return { success: false, reason: `Network error connecting to Microsoft Graph API` };
    }
  }

  function isRealCameraPhoto(item) {
    const name = (item.name || '').toLowerCase();
    const explicitTerms = ['screenshot', 'screen_shot', 'captura', 'document', 'receipt', 'scan'];
    for (const term of explicitTerms) {
      if (name.includes(term)) return false;
    }
    return true;
  }

  function transformOneDriveItem(item) {
    const photoUrl = item['@microsoft.graph.downloadUrl'] || 
                     (item.thumbnails && item.thumbnails[0] && item.thumbnails[0].large ? item.thumbnails[0].large.url : '');

    const photoMeta = item.photo || {};
    const exifParts = [];
    if (photoMeta.focalLength) exifParts.push(`${photoMeta.focalLength}mm`);
    if (photoMeta.fNumber) exifParts.push(`f/${photoMeta.fNumber}`);
    if (photoMeta.exposureDenominator) exifParts.push(`1/${photoMeta.exposureDenominator}s`);
    if (photoMeta.iso) exifParts.push(`ISO ${photoMeta.iso}`);

    let dateStr = 'Unknown Date';
    if (photoMeta.takenDateTime) {
      dateStr = photoMeta.takenDateTime.replace('T', ' ').substring(0, 16);
    } else if (item.createdDateTime) {
      dateStr = item.createdDateTime.replace('T', ' ').substring(0, 16);
    }

    const cameraStr = [photoMeta.cameraMake, photoMeta.cameraModel].filter(Boolean).join(' ') || 'OneDrive Camera Asset';

    const loc = item.location;
    let locStr = 'OneDrive Cloud Storage';
    if (loc && loc.latitude && loc.longitude) {
      locStr = `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°`;
    }

    return {
      id: item.id,
      title: item.name || 'OneDrive Photo',
      date: dateStr,
      location: locStr,
      camera: cameraStr,
      exif: exifParts.length > 0 ? exifParts.join(' • ') : 'Digital Capture',
      url: photoUrl
    };
  }

  function setSystemStatus(text, isOnline) {
    elSysStatusText.textContent = text;
    if (isOnline) {
      elStatusPill.className = 'status-pill online';
    } else {
      elStatusPill.className = 'status-pill offline';
    }
  }

  // --- Slideshow Display & Ken Burns Handler ---
  function showPhoto(index) {
    if (!photoList || photoList.length === 0) return;

    const photo = photoList[index];
    elPhotoCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(photoList.length).padStart(2, '0')}`;

    elPhotoTitle.textContent = photo.title;
    elMetaDate.textContent = photo.date;
    elMetaLocation.textContent = photo.location;
    elMetaCamera.textContent = photo.camera;
    elMetaExif.textContent = photo.exif;

    const nextLayer = activeLayer === 1 ? elLayer2 : elLayer1;
    const currentLayer = activeLayer === 1 ? elLayer1 : elLayer2;

    nextLayer.style.backgroundImage = `url("${photo.url}")`;

    const kenburnsClass = (index % 2 === 0) ? 'kenburns-1' : 'kenburns-2';
    nextLayer.className = `photo-layer ${config.enableKenBurns ? kenburnsClass : ''}`;
    
    setTimeout(() => {
      nextLayer.classList.add('active');
      currentLayer.classList.remove('active');
      activeLayer = activeLayer === 1 ? 2 : 1;
    }, 50);

    resetProgressBar();
  }

  function nextPhoto() {
    if (photoList.length === 0) return;
    currentIndex = (currentIndex + 1) % photoList.length;
    showPhoto(currentIndex);
  }

  function prevPhoto() {
    if (photoList.length === 0) return;
    currentIndex = (currentIndex - 1 + photoList.length) % photoList.length;
    showPhoto(currentIndex);
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      btnPause.textContent = '▶';
      btnPause.title = 'Play (Spacebar)';
      clearInterval(slideTimer);
      clearInterval(progressInterval);
    } else {
      btnPause.textContent = '⏸';
      btnPause.title = 'Pause (Spacebar)';
      startSlideshowTimer();
    }
  }

  function startSlideshowTimer() {
    clearInterval(slideTimer);
    clearInterval(progressInterval);
    if (isPaused) return;

    const durationMs = config.slideDuration * 1000;
    slideStartTime = Date.now();

    slideTimer = setInterval(() => {
      nextPhoto();
    }, durationMs);

    progressInterval = setInterval(() => {
      const elapsed = Date.now() - slideStartTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      elProgressBar.style.width = `${pct}%`;
    }, 100);
  }

  function resetProgressBar() {
    slideStartTime = Date.now();
    elProgressBar.style.width = '0%';
  }

  // --- UI & Modal Controls ---
  function setupEventListeners() {
    btnNext.addEventListener('click', () => { nextPhoto(); startSlideshowTimer(); });
    btnPrev.addEventListener('click', () => { prevPhoto(); startSlideshowTimer(); });
    btnPause.addEventListener('click', togglePause);

    btnScanline.addEventListener('click', () => {
      config.enableScanlines = !config.enableScanlines;
      chkScanlines.checked = config.enableScanlines;
      saveConfig();
      elScanline.classList.toggle('disabled', !config.enableScanlines);
    });

    btnFullscreen.addEventListener('click', toggleFullscreen);

    btnOpenSettings.addEventListener('click', () => { modalSettings.classList.add('active'); });
    btnCloseSettings.addEventListener('click', () => { modalSettings.classList.remove('active'); });

    btnTestConnection.addEventListener('click', testConnection);

    btnSaveSettings.addEventListener('click', (e) => {
      e.preventDefault();
      config.onedriveToken = inputToken.value.trim();
      config.onedriveFolder = inputFolder.value.trim();
      config.filterScreenshots = chkFilterScreenshots.checked;
      config.albumQuery = inputAlbumQuery.value.trim();
      config.slideDuration = Math.max(3, parseInt(inputSlideDuration.value, 10) || 15);
      config.enableKenBurns = chkKenBurns.checked;
      config.enableScanlines = chkScanlines.checked;
      config.enableFallbackDemo = chkFallbackDemo.checked;

      saveConfig();
      applyConfigUI();
      modalSettings.classList.remove('active');

      fetchPhotosAndStart();
    });

    window.addEventListener('keydown', (e) => {
      if (modalSettings.classList.contains('active')) {
        if (e.key === 'Escape') modalSettings.classList.remove('active');
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          nextPhoto();
          startSlideshowTimer();
          break;
        case 'ArrowLeft':
          prevPhoto();
          startSlideshowTimer();
          break;
        case ' ':
        case 'Enter':
          togglePause();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 's':
        case 'S':
          btnScanline.click();
          break;
        case 'm':
        case 'M':
        case 'c':
        case 'C':
          modalSettings.classList.add('active');
          break;
      }
    });
  }

  async function testConnection() {
    elTestResult.textContent = 'Testing OneDrive connection...';
    elTestResult.className = 'test-result-msg';

    let token = inputToken.value.trim();
    if (!token) {
      const local = await loadTokensFromFile();
      if (local && local.access_token) token = local.access_token;
    }

    if (!token) {
      elTestResult.textContent = '❌ No Token found. Run ./scripts/onedrive-login.sh over SSH first.';
      elTestResult.className = 'test-result-msg error';
      return;
    }

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        elTestResult.textContent = `✓ Connected to OneDrive! Account: ${data.owner?.user?.displayName || 'User'}`;
        elTestResult.className = 'test-result-msg success';
      } else if (res.status === 401) {
        elTestResult.textContent = '✗ Token Expired or Invalid. Re-run ./scripts/onedrive-login.sh over SSH.';
        elTestResult.className = 'test-result-msg error';
      } else {
        elTestResult.textContent = `✗ HTTP Error ${res.status}`;
        elTestResult.className = 'test-result-msg error';
      }
    } catch (e) {
      elTestResult.textContent = '✗ Network error connecting to Microsoft Graph API';
      elTestResult.className = 'test-result-msg error';
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
