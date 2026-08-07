import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import convert from 'heic-convert';

export const dynamic = 'force-dynamic';

function getStoredTokens() {
  const possiblePaths = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'dashboard', 'onedrive_tokens.json')
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
    const cId = clientId || '14d82eec-204b-4c2f-b7e8-296a70dab67e';
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

// In-memory cache for converted full-res JPEG buffers to eliminate re-conversion overhead
const conversionCache = new Map();
const MAX_CACHE_ITEMS = 50;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const customToken = searchParams.get('token') || '';

  if (!id) {
    return new NextResponse('Missing photo ID parameter', { status: 400 });
  }

  // Check in-memory cache first
  if (conversionCache.has(id)) {
    const cachedBuffer = conversionCache.get(id);
    return new NextResponse(cachedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable'
      }
    });
  }

  let tokens = getStoredTokens();
  let accessToken = customToken || (tokens ? tokens.access_token : '');
  let refreshToken = tokens ? tokens.refresh_token : '';
  let clientId = tokens ? tokens.client_id : '14d82eec-204b-4c2f-b7e8-296a70dab67e';
  let tenant = tokens ? tokens.tenant : 'consumers';

  if (!accessToken && !refreshToken) {
    return new NextResponse('Unauthorized: No OneDrive access token', { status: 401 });
  }

  let itemRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if ((itemRes.status === 401 || itemRes.status === 403) && refreshToken) {
    const newAccessToken = await refreshAccessToken(refreshToken, clientId, tenant);
    if (newAccessToken) {
      accessToken = newAccessToken;
      itemRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    }
  }

  if (!itemRes.ok) {
    return new NextResponse(`OneDrive item fetch failed: ${itemRes.statusText}`, { status: itemRes.status });
  }

  const item = await itemRes.json();
  const name = (item.name || '').toLowerCase();
  const mime = (item.file && item.file.mimeType ? item.file.mimeType : '').toLowerCase();
  const isHeic = name.endsWith('.heic') || name.endsWith('.heif') || mime.includes('heic') || mime.includes('heif');

  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) {
    return new NextResponse('Download URL unavailable for photo', { status: 404 });
  }

  try {
    const rawRes = await fetch(downloadUrl);
    if (!rawRes.ok) {
      return new NextResponse('Failed to fetch raw photo file from OneDrive', { status: 502 });
    }

    const inputBuffer = Buffer.from(await rawRes.arrayBuffer());

    let jpegBuffer;
    if (isHeic || (inputBuffer[0] === 0x00 && inputBuffer[4] === 0x66 && inputBuffer[5] === 0x74 && inputBuffer[6] === 0x79 && inputBuffer[7] === 0x70)) {
      // Convert HEIC buffer to full native resolution JPEG (quality 0.95)
      jpegBuffer = await convert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 0.95
      });
    } else {
      // Already a standard image format (JPEG/PNG/WEBP)
      jpegBuffer = inputBuffer;
    }

    // Save to LRU cache
    if (conversionCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = conversionCache.keys().next().value;
      conversionCache.delete(firstKey);
    }
    conversionCache.set(id, jpegBuffer);

    return new NextResponse(jpegBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable'
      }
    });
  } catch (err) {
    console.error(`HEIC conversion error for item ${id}:`, err);
    return new NextResponse(`Error converting image: ${err.message}`, { status: 500 });
  }
}
