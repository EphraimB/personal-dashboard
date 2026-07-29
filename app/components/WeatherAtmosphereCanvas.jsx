'use client';

import { useEffect, useRef } from 'react';

export default function WeatherAtmosphereCanvas({ code = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Determine atmospheric mode based on Open-Meteo weather code
    const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
    const isThunder = code >= 95;
    const isFog = code === 45 || code === 48;
    const isSun = code === 0 || code === 1;

    // Create particle systems
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
          speed: Math.random() * 12 + 10,
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
          speed: Math.random() * 1.5 + 0.5,
          drift: Math.random() * 0.8 - 0.4,
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
          speed: Math.random() * 0.3 + 0.1,
          opacity: Math.random() * 0.15 + 0.05
        });
      }
    }

    let thunderFlash = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render Thunderstorm Flashes
      if (isThunder) {
        if (Math.random() < 0.015) {
          thunderFlash = 0.45;
        }
        if (thunderFlash > 0) {
          ctx.fillStyle = `rgba(0, 240, 255, ${thunderFlash})`;
          ctx.fillRect(0, 0, width, height);
          thunderFlash -= 0.03;
        }
      }

      // Render Rain Particles
      if (isRain || isThunder) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const d of rainDrops) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${d.opacity})`;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 2, d.y + d.length);
          d.y += d.speed;
          d.x -= 0.8;
          if (d.y > height) {
            d.y = -d.length;
            d.x = Math.random() * width;
          }
        }
        ctx.stroke();
      }

      // Render Snow Particles
      if (isSnow) {
        ctx.fillStyle = '#ffffff';
        for (const s of snowFlakes) {
          ctx.save();
          ctx.globalAlpha = s.opacity;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          s.y += s.speed;
          s.x += s.drift;
          if (s.y > height) {
            s.y = -s.radius;
            s.x = Math.random() * width;
          }
        }
      }

      // Render Fog Particles
      if (isFog) {
        for (const f of fogClouds) {
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
          grad.addColorStop(0, `rgba(0, 255, 136, ${f.opacity})`);
          grad.addColorStop(1, 'rgba(0, 255, 136, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          f.x += f.speed;
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

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [code]);

  return <canvas ref={canvasRef} className="weather-atmosphere-canvas" />;
}
