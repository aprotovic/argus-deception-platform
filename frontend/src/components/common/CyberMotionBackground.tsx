import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

interface DataPacket {
  fromIndex: number;
  toIndex: number;
  progress: number;
  speed: number;
  size: number;
}

interface TelemetryTag {
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  alpha: number;
}

export const CyberMotionBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let scanlineY = 0;
    const scanlineSpeed = 1.1;

    // Handle high DPI displays
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Track mouse coordinates globally with passive listener
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);

    // Initialize particles (constellation nodes)
    const particleCount = Math.max(35, Math.min(65, Math.floor((width * height) / 22000)));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.8 + 1.2,
        baseAlpha: Math.random() * 0.4 + 0.35,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Telemetry text overlays drifting in deep background
    const telemetryStrings = [
      '// DECEPTION_MESH: ONLINE',
      '// NODE_SURFACE: ARMED',
      '// DISA_STIG_ENCLAVE: ACTIVE',
      '// ZERO_DAY_TELEMETRY',
      '// MITRE_SYNTHESIS: ENGAGED',
      '// CANARY_CREDENTIALS: SEEDED',
      '// LATENCY < 42ms',
      '// SHA-256 VAULT CUSTODY',
    ];

    const telemetryTags: TelemetryTag[] = telemetryStrings.map((label, idx) => ({
      x: (idx * 240 + 100) % Math.max(width - 150, 400),
      y: (idx * 160 + 80) % Math.max(height - 100, 300),
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      label,
      alpha: Math.random() * 0.12 + 0.14,
    }));

    // Data packets hopping between nodes
    const dataPackets: DataPacket[] = [];
    const maxPackets = 6;

    const spawnDataPacket = () => {
      if (dataPackets.length >= maxPackets || particles.length < 2) return;
      const from = Math.floor(Math.random() * particles.length);
      // find a neighbor within 160px
      for (let j = 0; j < particles.length; j++) {
        if (j === from) continue;
        const dx = particles[from].x - particles[j].x;
        const dy = particles[from].y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          dataPackets.push({
            fromIndex: from,
            toIndex: j,
            progress: 0,
            speed: Math.random() * 0.015 + 0.012,
            size: Math.random() * 1.5 + 2.2,
          });
          break;
        }
      }
    };

    let tick = 0;
    let isTabVisible = true;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Main animation loop
    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      tick++;
      if (tick % 70 === 0) {
        spawnDataPacket();
      }

      ctx.clearRect(0, 0, width, height);

      // ── 1. Cyber Coordinate Matrix Grid ──
      const gridSize = 64;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.025)';
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // ── 2. Radar / Sonar Tactical Laser Scanline ──
      scanlineY += scanlineSpeed;
      if (scanlineY > height + 80) {
        scanlineY = -80;
      }

      const scanGrad = ctx.createLinearGradient(0, scanlineY - 40, 0, scanlineY + 40);
      scanGrad.addColorStop(0, 'rgba(0, 255, 157, 0)');
      scanGrad.addColorStop(0.5, 'rgba(0, 255, 157, 0.08)');
      scanGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanlineY - 40, width, 80);

      // Sharp central scan beam
      ctx.strokeStyle = 'rgba(0, 255, 157, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, scanlineY);
      ctx.lineTo(width, scanlineY);
      ctx.stroke();

      // ── 3. Drifting Telemetry HUD Tags ──
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#10b981';
      for (let t = 0; t < telemetryTags.length; t++) {
        const tag = telemetryTags[t];
        tag.x += tag.vx;
        tag.y += tag.vy;

        if (tag.x < 20) tag.vx = Math.abs(tag.vx);
        if (tag.x > width - 180) tag.vx = -Math.abs(tag.vx);
        if (tag.y < 30) tag.vy = Math.abs(tag.vy);
        if (tag.y > height - 30) tag.vy = -Math.abs(tag.vy);

        ctx.globalAlpha = tag.alpha;
        ctx.fillText(tag.label, tag.x, tag.y);

        // Small corner crosshair on tag
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tag.x - 6, tag.y - 12, 4, 4);
      }
      ctx.globalAlpha = 1;

      // ── 4. Particle Physics & Connection Constellations ──
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;
      const maxConnectDist = 145;

      // Update positions
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Gentle floating
        p.x += p.vx;
        p.y += p.vy;

        // Bounce from boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction (soft displacement)
        if (mouseActive) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140 && dist > 1) {
            const force = (140 - dist) / 140;
            p.x -= (dx / dist) * force * 1.5;
            p.y -= (dy / dist) * force * 1.5;
          }
        }

        p.pulsePhase += p.pulseSpeed;
      }

      // Draw connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxConnectDist) {
            const alpha = (1 - dist / maxConnectDist) * 0.22;

            // Highlight connections near the scanline
            const nearScan = Math.abs((p1.y + p2.y) / 2 - scanlineY) < 50;
            const boost = nearScan ? 0.25 : 0;

            ctx.strokeStyle = `rgba(0, 255, 157, ${alpha + boost})`;
            ctx.lineWidth = nearScan ? 1.4 : 0.85;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw hopping data packets
      for (let k = dataPackets.length - 1; k >= 0; k--) {
        const pkt = dataPackets[k];
        const pFrom = particles[pkt.fromIndex];
        const pTo = particles[pkt.toIndex];

        if (!pFrom || !pTo) {
          dataPackets.splice(k, 1);
          continue;
        }

        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          dataPackets.splice(k, 1);
          continue;
        }

        const currX = pFrom.x + (pTo.x - pFrom.x) * pkt.progress;
        const currY = pFrom.y + (pTo.y - pFrom.y) * pkt.progress;

        ctx.fillStyle = '#00ff9d';
        ctx.shadowColor = '#00ff9d';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(currX, currY, pkt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw particle nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const pulse = Math.sin(p.pulsePhase) * 0.25 + 0.75;
        const alpha = Math.min(1, p.baseAlpha * pulse);

        // Scanline excitation
        const isIlluminated = Math.abs(p.y - scanlineY) < 45;
        const finalAlpha = isIlluminated ? Math.min(1, alpha + 0.45) : alpha;

        // Outer glow
        ctx.fillStyle = `rgba(0, 255, 157, ${finalAlpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Core bright point
        ctx.fillStyle = isIlluminated ? '#00ff9d' : '#10b981';
        ctx.shadowColor = '#00ff9d';
        ctx.shadowBlur = isIlluminated ? 12 : 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ── 5. Interactive Mouse Reticle Overlay ──
      if (mouseActive && mx > 0 && my > 0) {
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.4)';
        ctx.lineWidth = 1;

        // Outer radar circle
        ctx.beginPath();
        ctx.arc(mx, my, 26, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing secondary ring
        const ringPulse = (tick % 60) / 60;
        ctx.strokeStyle = `rgba(16, 185, 129, ${(1 - ringPulse) * 0.35})`;
        ctx.beginPath();
        ctx.arc(mx, my, 26 + ringPulse * 28, 0, Math.PI * 2);
        ctx.stroke();

        // Center crosshair
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.6)';
        ctx.beginPath();
        ctx.moveTo(mx - 8, my);
        ctx.lineTo(mx + 8, my);
        ctx.moveTo(mx, my - 8);
        ctx.lineTo(mx, my + 8);
        ctx.stroke();

        // Live coordinate HUD
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#34d399';
        ctx.fillText(`LOC [${Math.floor(mx)} : ${Math.floor(my)}]`, mx + 32, my - 8);
        ctx.fillText('STATUS: LOCKED', mx + 32, my + 4);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        background: '#010503',
      }}
    >
      {/* Deep Obsidian Black Base with Ambient Emerald Nebulae */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 45% at 50% -5%, rgba(16, 185, 129, 0.08) 0%, transparent 65%),
            radial-gradient(ellipse 55% 40% at 85% 30%, rgba(0, 255, 157, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 15% 75%, rgba(5, 150, 105, 0.06) 0%, transparent 60%),
            linear-gradient(180deg, #020604 0%, #010403 40%, #000000 100%)
          `,
          opacity: 0.98,
        }}
      />

      {/* Cyber Motion Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Tactical Vignette Mask for High Contrast Content Legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 50%, rgba(0, 0, 0, 0.6) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
