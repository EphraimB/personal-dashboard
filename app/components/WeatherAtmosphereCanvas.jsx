'use client';

import { useEffect, useRef } from 'react';

export default function WeatherAtmosphereCanvas({ code = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId = null;

    let dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const setupCanvasSize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    setupCanvasSize();

    const handleResize = () => {
      if (!canvas) return;
      setupCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    // Determine atmospheric mode based on Open-Meteo weather code
    const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
    const isThunder = code >= 95;
    const isFog = code === 45 || code === 48;
    const isSun = code === 0 || code === 1;

    // Create particle systems with velocities calibrated in pixels per second
    const rainDrops = [];
    const snowFlakes = [];
    const fogClouds = [];

    if (isRain || isThunder) {
      const dropCount = isThunder ? 180 : 100;
      for (let i = 0; i < dropCount; i++) {
        rainDrops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * 20 + 10,
          speed: Math.random() * 700 + 600, // px per sec
          opacity: Math.random() * 0.4 + 0.2
        });
      }
    }

    if (isSnow) {
      for (let i = 0; i < 90; i++) {
        snowFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 90 + 30, // px per sec
          drift: Math.random() * 48 - 24, // px per sec
          opacity: Math.random() * 0.7 + 0.3
        });
      }
    }

    if (isFog) {
      for (let i = 0; i < 6; i++) {
        fogClouds.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 300 + 200,
          speed: Math.random() * 18 + 6, // px per sec
          opacity: Math.random() * 0.15 + 0.05
        });
      }
    }

    let thunderFlash = 0;
    let lastTime = performance.now();

    const render = (now) => {
      if (!lastTime) lastTime = now;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      // Cap dt to 100ms to prevent huge physics jumps on frame drops or tab switches
      const dt = Math.min(rawDt, 0.1);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Render Thunderstorm Flashes
      if (isThunder) {
        if (Math.random() < 0.9 * dt) {
          thunderFlash = 0.45;
        }
        if (thunderFlash > 0) {
          ctx.fillStyle = `rgba(0, 240, 255, ${thunderFlash})`;
          ctx.fillRect(0, 0, width, height);
          thunderFlash -= 1.8 * dt;
        }
      }

      // Render Rain Particles
      if (isRain || isThunder) {
        ctx.lineWidth = 1.2;
        for (const d of rainDrops) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${d.opacity})`;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 2, d.y + d.length);
          ctx.stroke();

          d.y += d.speed * dt;
          d.x -= 48 * dt;
          if (d.y > height) {
            d.y = -d.length;
            d.x = Math.random() * width;
          }
        }
      }

      // Render Snow Particles (without save/restore overhead)
      if (isSnow) {
        ctx.fillStyle = '#ffffff';
        for (const s of snowFlakes) {
          ctx.globalAlpha = s.opacity;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();

          s.y += s.speed * dt;
          s.x += s.drift * dt;
          if (s.y > height) {
            s.y = -s.radius;
            s.x = Math.random() * width;
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Render Fog Particles
      if (isFog) {
        for (const f of fogClouds) {
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
          grad.addColorStop(0, `rgba(0, 255, 136, ${f.opacity})`);
          grad.addColorStop(1, 'rgba(0, 255, 136, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          f.x += f.speed * dt;
          if (f.x - f.radius > width) {
            f.x = -f.radius;
          }
        }
      }

      // Render Sun Flares
      if (isSun) {
        const sunGrad = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, 350);
        sunGrad.addColorStop(0, 'rgba(255, 179, 0, 0.12)');
        sunGrad.addColorStop(0.5, 'rgba(255, 87, 34, 0.05)');
        sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      } else {
        lastTime = performance.now();
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [code]);

  return <canvas ref={canvasRef} className="weather-atmosphere-canvas" />;
}

