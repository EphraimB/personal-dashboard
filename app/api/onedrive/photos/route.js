import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DEMO_PHOTOS = [
  {
    id: 'demo-1',
    title: 'Ares Habitat Surface Survey',
    description: 'High-resolution atmospheric survey captured by Rover Optical Unit 4 over the eastern flank of Ares Crater. Atmospheric dust density remains within expected operational parameters for habitat maintenance.',
    date: '2026-07-21 18:45',
    location: 'Ares Crater, Mars System',
    camera: 'Ares Rover Optical Cam 4K',
    exif: '24mm • f/4.0 • 1/1000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-2',
    title: 'Nebula Horizon Over City',
    description: 'Long exposure nocturnal panoramic of the metropolis baseline. Glowing cybernetic grids reflect off low-altitude cloud cover during peak solar flare activity.',
    date: '2026-06-15 22:10',
    location: 'Citizen Suite Penthouse',
    camera: 'Sony Alpha A7 IV',
    exif: '35mm • f/1.8 • 1/60s • ISO 800',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-3',
    title: 'Pressurized Mountain Pass',
    description: 'Crisp alpine morning vista captured along the Sector 02 high-altitude transit corridor. Glacial runoff feeds into pressurized reservoir facilities downstream.',
    date: '2026-05-04 11:30',
    location: 'Sector 02 Alpine Loop',
    camera: 'Fujifilm X-T5',
    exif: '16mm • f/8.0 • 1/250s • ISO 200',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-4',
    title: 'Cosmic Reflection Lake',
    description: 'Serene sunrise framing the bio-dome reflection pools in the Northern Colony Sanctuary. Early morning mist dissipates as thermal array cycles begin.',
    date: '2026-04-12 05:20',
    location: 'Northern Colony Sanctuary',
    camera: 'Canon EOS R5',
    exif: '50mm • f/1.4 • 1/4000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-5',
    title: 'Deep Space Orbital Aurora',
    description: 'Orbital spectrograph tracking magnetic field oscillations and ion density glows in upper thermosphere. Telemetry streamed live to primary TV HUD arrays.',
    date: '2026-03-29 02:15',
    location: 'Ares City Orbital Platform',
    camera: 'Orbital Tele-Array Mark III',
    exif: '85mm • f/1.2 • 1/30s • ISO 1600',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000&auto=format&fit=crop'
  }
];

function getStoredTokens() {
  const possiblePaths = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'dashboard', 'onedrive_tokens.json'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'onedrive_tokens.json')
  ];

  for (const tokenPath of possiblePaths) {
    if (fs.existsSync(tokenPath)) {
      try {
        const content = fs.readFileSync(tokenPath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        // invalid JSON
      }
    }
  }
  return null;
}

async function refreshAccessToken(refreshToken, clientId, tenant) {
  try {
    const cId = clientId || 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
    const t = tenant || 'consumers';
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
      return data.access_token || null;
    }
  } catch (e) {
    console.error('Token refresh error:', e);
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || '';
  const query = searchParams.get('query') || '';
  const customToken = searchParams.get('token') || '';
  const filterScreenshots = searchParams.get('filterScreenshots') !== 'false';

  let tokens = getStoredTokens();
  let accessToken = customToken || (tokens ? tokens.access_token : '');
  let refreshToken = tokens ? tokens.refresh_token : '';
  let clientId = tokens ? tokens.client_id : 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
  let tenant = tokens ? tokens.tenant : 'consumers';

  if (!accessToken && !refreshToken) {
    return NextResponse.json({
      success: false,
      reason: 'No OneDrive tokens found. Run ./scripts/onedrive-login.sh over SSH',
      demoPhotos: DEMO_PHOTOS
    });
  }

  let result = await fetchGraphPhotos(accessToken, folder, query, filterScreenshots);

  if (!result.success && refreshToken) {
    const newAccessToken = await refreshAccessToken(refreshToken, clientId, tenant);
    if (newAccessToken) {
      result = await fetchGraphPhotos(newAccessToken, folder, query, filterScreenshots);
    }
  }

  if (!result.success) {
    return NextResponse.json({
      success: false,
      reason: result.reason,
      demoPhotos: DEMO_PHOTOS
    });
  }

  return NextResponse.json({
    success: true,
    photos: result.photos
  });
}

async function fetchGraphPhotos(token, folder, query, filterScreenshots) {
  try {
    let endpoint = 'https://graph.microsoft.com/v1.0/me/drive/special/photos/children?$expand=thumbnails&$top=500';

    if (folder.trim()) {
      const cleanPath = folder.trim().replace(/^\/+|\/+$/g, '');
      endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(cleanPath)}:/children?$expand=thumbnails&$top=500`;
    } else if (query.trim()) {
      endpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query.trim())}')?$expand=thumbnails&$top=500`;
    }

    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, reason: 'OneDrive Token Expired / Access Denied. Re-run ./scripts/onedrive-login.sh' };
    }

    if (!response.ok) {
      return { success: false, reason: `Microsoft Graph API Error HTTP ${response.status}` };
    }

    const data = await response.json();
    const items = data.value || [];

    if (items.length === 0) {
      return { success: false, reason: '0 Photos found in specified OneDrive location' };
    }

    const imageItems = items.filter(item => {
      if (!item.file) return false;
      const mime = (item.file.mimeType || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      const isImage = mime.startsWith('image/') || name.endsWith('.heic') || name.endsWith('.heif');
      if (!isImage) return false;
      if (filterScreenshots && isScreenshot(item)) return false;
      return true;
    });

    const itemsToUse = imageItems.length > 0 ? imageItems : items.filter(i => i.file && (i.file.mimeType || '').startsWith('image/'));

    if (itemsToUse.length === 0) {
      return { success: false, reason: 'No photo assets found in OneDrive folder' };
    }

    const transformed = itemsToUse.map(item => transformOneDriveItem(item));
    return { success: true, photos: transformed };
  } catch (e) {
    return { success: false, reason: `Network error connecting to Microsoft Graph API: ${e.message}` };
  }
}

function isScreenshot(item) {
  const name = (item.name || '').toLowerCase();
  const explicitTerms = ['screenshot', 'screen_shot', 'captura', 'document', 'receipt', 'scan'];
  for (const term of explicitTerms) {
    if (name.includes(term)) return true;
  }
  return false;
}

function cleanTitle(rawName) {
  if (!rawName) return 'Captured Moment';
  let cleaned = rawName
    .replace(/\.(jpg|jpeg|png|heic|heif|webp|gif)$/i, '')
    .replace(/^(IMG_|DSC_|PXL_|PHOTO_|Screenshot_)/i, '')
    .replace(/[-_]/g, ' ')
    .trim();

  // Capitalize words cleanly if it was a filename
  cleaned = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned || 'Captured Moment';
}

function transformOneDriveItem(item) {
  const name = (item.name || '').toLowerCase();
  const mime = (item.file && item.file.mimeType ? item.file.mimeType : '').toLowerCase();
  const isHeic = name.endsWith('.heic') || name.endsWith('.heif') || mime.includes('heic') || mime.includes('heif');

  let photoUrl = '';

  // Extract Microsoft Graph API converted JPEG thumbnail for HEIC/HEIF browser rendering
  if (item.thumbnails && item.thumbnails.length > 0) {
    const thumb = item.thumbnails[0];
    photoUrl = (thumb.c2048x2048 && thumb.c2048x2048.url) || 
               (thumb.large && thumb.large.url) || 
               (thumb.medium && thumb.medium.url) || 
               (thumb.source && thumb.source.url) || '';
  }

  // Use direct download URL for standard JPEGs, or fallback to converted thumbnail for HEIC
  if (!isHeic && item['@microsoft.graph.downloadUrl']) {
    photoUrl = item['@microsoft.graph.downloadUrl'];
  } else if (!photoUrl) {
    photoUrl = item['@microsoft.graph.downloadUrl'] || '';
  }

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

  const cameraStr = [photoMeta.cameraMake, photoMeta.cameraModel].filter(Boolean).join(' ') || 'Digital Camera';

  const loc = item.location || {};
  let locStr = 'Personal Collection';
  let lat = loc.latitude || null;
  let lon = loc.longitude || null;

  if (lat && lon) {
    locStr = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }

  const desc = item.description || 
             (item.photo && item.photo.caption) || 
             `Captured on ${dateStr}. Camera: ${cameraStr}.`;

  return {
    id: item.id,
    title: cleanTitle(item.name),
    description: desc,
    date: dateStr,
    location: locStr,
    latitude: lat,
    longitude: lon,
    camera: cameraStr,
    exif: exifParts.length > 0 ? exifParts.join(' • ') : 'Digital Capture',
    url: photoUrl
  };
}
