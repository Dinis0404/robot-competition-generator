/* ==========================================================
   彩帶粒子效果 — Canvas，無外部依賴
   ========================================================== */
const Confetti = (function () {
  'use strict';
  const cvs = document.getElementById('confetti');
  const ctx = cvs.getContext('2d');
  const COLORS = ['#4cc9f0', '#7b5cff', '#ffc857', '#3ddc97', '#ff5d73', '#ff7ab6', '#ffffff'];
  let parts = [];
  let raf = null;

  function resize() {
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawn(n, ox, oy, power) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = (0.35 + Math.random() * 0.65) * power;
      parts.push({
        x: ox,
        y: oy,
        vx: Math.cos(ang) * speed * (0.7 + Math.random() * 0.6),
        vy: Math.sin(ang) * speed - power * 0.75, // 整體向上噴
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        decay: 0.004 + Math.random() * 0.006
      });
    }
    if (!raf) loop();
  }

  function loop() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    parts = parts.filter(function (p) { return p.life > 0 && p.y < cvs.height + 40; });
    if (parts.length === 0) { raf = null; return; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.vy += 0.32;            // 重力
      p.vx *= 0.985;           // 空氣阻力
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.7)) + 2);
      ctx.restore();
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    /** 中央慶祝噴發 */
    burst: function (n) {
      n = n || 140;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.42;
      spawn(Math.round(n * 0.5), cx, cy, 16);
      spawn(Math.round(n * 0.25), window.innerWidth * 0.12, window.innerHeight * 0.75, 13);
      spawn(Math.round(n * 0.25), window.innerWidth * 0.88, window.innerHeight * 0.75, 13);
    }
  };
})();
