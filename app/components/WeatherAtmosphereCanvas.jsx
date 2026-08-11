'use client';

import { useEffect, useRef } from 'react';

export default function WeatherAtmosphereCanvas({ code = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId = null;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const setupCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
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
    const isDrizzle = (code >= 51 && code <= 57);
    const isModerateRain = (code === 61 || code === 63 || code === 80 || code === 81);
    const isHeavyRain = (code === 65 || code === 66 || code === 67 || code === 82);
    const isThunder = code >= 95;
    const isRain = isDrizzle || isModerateRain || isHeavyRain || isThunder;

    const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
    const isFog = code === 45 || code === 48;
    const isSun = code === 0 || code === 1;

    // Render Sun Flares statically once if clear
    if (isSun) {
      ctx.clearRect(0, 0, width, height);
      const sunGrad = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, 350);
      sunGrad.addColorStop(0, 'rgba(255, 179, 0, 0.12)');
      sunGrad.addColorStop(0.5, 'rgba(255, 87, 34, 0.05)');
      sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, width, height);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    const rainDrops = [];
    const snowFlakes = [];
    const fogClouds = [];

    if (isRain) {
      let dropCount = 70;
      let minSpeed = 500;
      let maxSpeed = 800;
      let minLength = 10;
      let maxLength = 20;

      if (isDrizzle) {
        dropCount = 45;
        minSpeed = 300;
        maxSpeed = 500;
        minLength = 6;
        maxLength = 12;
      } else if (isModerateRain) {
        dropCount = 95;
        minSpeed = 700;
        maxSpeed = 1000;
        minLength = 12;
        maxLength = 24;
      } else if (isHeavyRain) {
        dropCount = 140;
        minSpeed = 1000;
        maxSpeed = 1400;
        minLength = 18;
        maxLength = 32;
      } else if (isThunder) {
        dropCount = 160;
        minSpeed = 1100;
        maxSpeed = 1500;
        minLength = 20;
        maxLength = 36;
      }

      for (let i = 0; i < dropCount; i++) {
        rainDrops.push({
          x: Math.random() * (width + 200) - 100,
          y: Math.random() * height,
          length: Math.random() * (maxLength - minLength) + minLength,
          speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
          opacity: isDrizzle ? (Math.random() * 0.3 + 0.15) : (Math.random() * 0.45 + 0.25)
        });
      }
    }

    if (isSnow) {
      for (let i = 0; i < 65; i++) {
        snowFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 90 + 30,
          drift: Math.random() * 48 - 24,
          opacity: Math.random() * 0.7 + 0.3
        });
      }
    }

    if (isFog) {
      for (let i = 0; i < 5; i++) {
        fogClouds.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 300 + 200,
          speed: Math.random() * 18 + 6,
          opacity: Math.random() * 0.15 + 0.05
        });
      }
    }

    let thunderFlash = 0;
    let flashStage = 0;
    let nextFlashTime = 1.5;
    let flashTimer = 0;
    let lastTime = performance.now();

    const render = (now) => {
      if (!lastTime) lastTime = now;
      const rawDt = (now - lastTime) / 1000;

      if (rawDt < 0.032) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastTime = now;
      const dt = Math.min(rawDt, 0.1);

      ctx.clearRect(0, 0, width, height);

      // Render Thunderstorm Flashes (Dramatic multi-stage lightning)
      if (isThunder) {
        flashTimer += dt;
        if (flashTimer > nextFlashTime) {
          flashTimer = 0;
          nextFlashTime = Math.random() * 3.5 + 2.0; // Random flash interval every 2-5.5s
          thunderFlash = 0.65;
          flashStage = 1;
        }

        if (thunderFlash > 0) {
          const flashGrad = ctx.createLinearGradient(0, 0, 0, height);
          flashGrad.addColorStop(0, `rgba(220, 245, 255, ${thunderFlash * 0.85})`);
          flashGrad.addColorStop(0.4, `rgba(0, 240, 255, ${thunderFlash * 0.5})`);
          flashGrad.addColorStop(1, `rgba(0, 200, 255, 0)`);
          ctx.fillStyle = flashGrad;
          ctx.fillRect(0, 0, width, height);

          thunderFlash -= 2.2 * dt;
          if (thunderFlash <= 0 && flashStage === 1 && Math.random() < 0.6) {
            // Secondary strike echo
            thunderFlash = 0.4;
            flashStage = 2;
          }
        }
      }

      // Render Rain Particles
      if (isRain) {
        ctx.lineWidth = isHeavyRain || isThunder ? 1.5 : (isDrizzle ? 0.9 : 1.2);
        for (const d of rainDrops) {
          ctx.strokeStyle = isThunder 
            ? `rgba(180, 235, 255, ${d.opacity})` 
            : `rgba(0, 240, 255, ${d.opacity})`;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          // Slanted rain angle
          const slant = isHeavyRain || isThunder ? -4 : -2;
          ctx.lineTo(d.x + slant, d.y + d.length);
          ctx.stroke();

          d.y += d.speed * dt;
          d.x += slant * (d.speed / 200) * dt;
          if (d.y > height) {
            d.y = -d.length;
            d.x = Math.random() * (width + 200) - 100;
          }
        }
      }

      // Render Snow Particles
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
