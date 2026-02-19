console.log("✅ background.js carregou");

(() => {
  "use strict";

  const canvas = document.getElementById("bgFx");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ✅ em mobile, use menos pontos/linhas p/ ficar suave
  const isMobile = matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const LINES = isMobile ? 8 : 11;
  const points = isMobile ? 160 : 220;

  const rnd = (a, b) => a + Math.random() * (b - a);

  let w = 0, h = 0, dpr = 1;

  const lines = Array.from({ length: LINES }, (_, i) => ({
    phase: rnd(0, Math.PI * 2),
    speed: rnd(0.16, 0.36) * (i % 2 ? 1 : -1),
    amp: rnd(isMobile ? 22 : 28, isMobile ? 62 : 80) + i * 3,
    y: 0,
    thick: rnd(isMobile ? 1.0 : 1.2, isMobile ? 2.1 : 2.6),
  }));

  function setLinesY() {
    for (let i = 0; i < lines.length; i++) {
      const p = i / (lines.length - 1);
      lines[i].y = h * (0.42 + p * 0.36); // 42%..78%
    }
  }

  // ✅ pega altura real no mobile (evita bug da barra)
  function getViewport() {
    const vw = Math.floor(window.innerWidth);
    const vh = Math.floor(
      (window.visualViewport && window.visualViewport.height) || window.innerHeight
    );
    return { vw, vh };
  }

  function resize() {
    const { vw, vh } = getViewport();
    w = vw;
    h = vh;

    dpr = Math.min(isMobile ? 1.75 : 2, window.devicePixelRatio || 1);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setLinesY();
  }

  // ✅ resize em tudo: orientation, visualViewport, etc
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize, { passive: true });
    window.visualViewport.addEventListener("scroll", resize, { passive: true });
  }
  resize();

  function bgGradient() {
    const g = ctx.createRadialGradient(
      w * 0.55,
      h * 0.45,
      0,
      w * 0.55,
      h * 0.45,
      Math.max(w, h) * 0.95
    );
    g.addColorStop(0, "rgba(22, 12, 36, 0.55)");
    g.addColorStop(0.35, "rgba(10, 8, 22, 0.30)");
    g.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawLine(t, L) {
    const baseY = L.y + Math.sin(t * 0.15 + L.phase) * (isMobile ? 18 : 22);
    const a = L.amp;

    const grad = ctx.createLinearGradient(0, baseY, w, baseY);
    grad.addColorStop(0, `rgba(155, 90, 255, 0.00)`);
    grad.addColorStop(0.20, `rgba(180, 110, 255, 0.48)`);
    grad.addColorStop(0.55, `rgba(220, 120, 255, 0.88)`);
    grad.addColorStop(0.86, `rgba(150, 80, 255, 0.48)`);
    grad.addColorStop(1, `rgba(155, 90, 255, 0.00)`);

    ctx.lineWidth = L.thick * (isMobile ? 2.7 : 3.0);
    ctx.strokeStyle = "rgba(170, 90, 255, 0.14)";
    ctx.shadowColor = "rgba(190, 110, 255, 0.30)";
    ctx.shadowBlur = isMobile ? 16 : 20;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * w;

      const wave1 = Math.sin((x / w) * Math.PI * 2 + t * L.speed + L.phase);
      const wave2 = Math.sin((x / w) * Math.PI * 4 - t * (L.speed * 0.65) + L.phase * 0.8);
      const wave3 = Math.sin((x / w) * Math.PI * 1.25 + t * 0.28);

      const y = baseY + wave1 * a * 0.55 + wave2 * a * 0.25 + wave3 * (isMobile ? 14 : 18);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.shadowBlur = isMobile ? 8 : 10;
    ctx.lineWidth = L.thick;
    ctx.strokeStyle = grad;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * w;

      const wave1 = Math.sin((x / w) * Math.PI * 2 + t * L.speed + L.phase);
      const wave2 = Math.sin((x / w) * Math.PI * 4 - t * (L.speed * 0.65) + L.phase * 0.8);
      const wave3 = Math.sin((x / w) * Math.PI * 1.25 + t * 0.28);

      const y = baseY + wave1 * a * 0.55 + wave2 * a * 0.25 + wave3 * (isMobile ? 14 : 18);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function vignette() {
    const v = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      Math.min(w, h) * 0.25,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.95
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    bgGradient();

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = isMobile ? 0.62 : 0.72;

    for (let i = 0; i < lines.length; i++) {
      drawLine(t, lines[i]);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    vignette();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  let start = performance.now();

  // ✅ fallback: se aba em background, reduz FPS
  let last = 0;
  function loop(now) {
    const t = (now - start) / 1000;

    const slow = prefersReduced ? 0.25 : 1.0;

    const targetFps = isMobile ? 45 : 60;
    const minDt = 1000 / targetFps;

    if (now - last >= minDt) {
      last = now;
      draw(t * slow);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
