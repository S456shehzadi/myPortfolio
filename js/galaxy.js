// Pure-canvas spiral galaxy with depth; faster motion + depth pulse
(function(){
  const canvas = document.getElementById('galaxy');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, DPR = 1;
  function resize(){
    DPR = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  let REDUCED = mq && mq.matches;
  if(mq && (mq.addEventListener||mq.addListener)){
    (mq.addEventListener||mq.addListener).call(mq,'change', e => { REDUCED = e.matches; });
  }

  // ===== Speed controls =====
  const SPEED_MULTIPLIER = 1.8;     // global speed knob (bump up/down later)
  const BASE_SPEED = 0.14;          // Option A: doubled base forward speed

  // ===== Depth pulse (zoom in/out) =====
  const ZOOM_AMPLITUDE = REDUCED ? 0.025 : 0.06; // how strong the pulse feels
  const ZOOM_SPEED     = REDUCED ? 0.12  : 0.18; // how fast the pulse cycles

  // ----- Starfield -----
  const STAR_COUNT = 700;
  const FOV = 420;        // base field-of-view
  const DEPTH = 1800;
  let stars = [];

  function makeStar(){
    return {
      x: (Math.random()-0.5)*W*2,
      y: (Math.random()-0.5)*H*2,
      z: Math.random()*DEPTH + 1,
      tw: Math.random()*0.6 + 0.4,
      hue: 200 + Math.random()*100
    };
  }

  function initStars(){ stars = new Array(STAR_COUNT).fill(0).map(makeStar); }

  // ----- Spiral arms -----
  const ARMS = 3;
  const ARM_PARTICLES = 400;
  const ARM_SPREAD = 0.55;
  let arms = [];

  function initArms(){
    arms = [];
    for(let a=0;a<ARMS;a++){
      const baseAngle = (Math.PI*2/ARMS) * a;
      const pts = [];
      for(let i=0;i<ARM_PARTICLES;i++){
        const r = Math.random();
        const radius = Math.pow(r, 0.7) * Math.min(W,H)*0.55;
        const angle = baseAngle + radius*0.008 + (Math.random()-0.5)*ARM_SPREAD;
        const depth = Math.random()*0.8 + 0.2;
        pts.push({ radius, angle, depth, size: 0.8 + Math.random()*1.6, hue: 260 + Math.random()*80 });
      }
      arms.push(pts);
    }
  }

  function drawGlowCircle(x,y,r, color, alpha){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x,y,0,x,y,r*2.5);
    g.addColorStop(0, color.replace('ALPHA', Math.min(1, alpha)));
    g.addColorStop(1, color.replace('ALPHA', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r*2.5,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  let t = 0;
  function tick(){
    if(!canvas.isConnected) return;
    t += 0.016;
    ctx.clearRect(0,0,W,H);

    // Depth pulse (zoom)
    const zoom = 1 + Math.sin(t * ZOOM_SPEED) * ZOOM_AMPLITUDE;

    // Forward motion — sped up + synced slightly with zoom
    const speed =
      (REDUCED ? BASE_SPEED * 0.5 : BASE_SPEED)
      * SPEED_MULTIPLIER
      * (1 + (zoom - 1) * 1.2)                    // speed up when “zooming in”
      * (1 + Math.sin(t * 0.15) * 0.05);          // subtle breathing variation

    const driftX = Math.sin(t*0.06) * 12;
    const driftY = Math.cos(t*0.05) * 10;

    // ----- Stars -----
    for(let i=0;i<STAR_COUNT;i++){
      const s = stars[i];
      s.z -= speed * (0.5 + s.tw*0.5);
      if(s.z <= 1){ stars[i] = makeStar(); stars[i].z = DEPTH; continue; }

      // perspective projection with zoom pulse
      const k = (FOV * zoom) / s.z;
      const px = (s.x + driftX) * k + W/2;
      const py = (s.y + driftY) * k + H/2;
      if(px<-50||px>W+50||py<-50||py>H+50) continue;

      const r = Math.max(0.2, 1.1*(1 - s.z/DEPTH));
      const a = 0.3 + (1 - s.z/DEPTH)*0.7*s.tw;
      ctx.fillStyle = `hsla(${s.hue},90%,70%,${a})`;
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();

      // motion streaks scale with speed and zoom
      if(!REDUCED && s.z < DEPTH*0.35){
        ctx.strokeStyle = `hsla(${s.hue},90%,70%,${a*0.8})`;
        ctx.lineWidth = r * 0.5;
        ctx.beginPath();
        ctx.moveTo(px,py);
        ctx.lineTo(px - (k * speed * 35), py); // longer streaks at higher speed
        ctx.stroke();
      }
    }

    // core glow — subtly scales with zoom
    const coreSize = Math.min(W,H) * (0.08 * (0.95 + (zoom-1)*1.2));
    drawGlowCircle(W/2, H/2, coreSize, 'rgba(150,120,255,ALPHA)', 0.6);

    // Spiral arms — faster spin, also gently influenced by zoom
    const rot = (REDUCED ? t*0.04 : t*0.08) * SPEED_MULTIPLIER * (0.98 + (zoom-1)*2.0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(const pts of arms){
      for(const p of pts){
        const ang = p.angle + rot;
        const rad = p.radius * (0.98 + Math.sin(t*0.2 + p.radius*0.002)*0.02);
        const x = W/2 + Math.cos(ang)*rad;
        const y = H/2 + Math.sin(ang)*rad;
        const alpha = 0.06 + p.depth*0.25;
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`;
        ctx.beginPath(); ctx.arc(x,y,p.size,0,Math.PI*2); ctx.fill();

        if(!REDUCED && p.size > 1.2){
          drawGlowCircle(x,y,p.size*2, 'rgba(120,140,255,ALPHA)', 0.25);
        }
      }
    }
    ctx.restore();

    // shooting stars — slight boost so scene feels alive
    if(!REDUCED && Math.random() < 0.006){
      const sx = Math.random()*W*0.8 + W*0.1;
      const sy = H*0.1 + Math.random()*H*0.3;
      const len = 100 + Math.random()*120;
      const ang = -Math.PI/4 - Math.random()*0.4;
      const hue = 200 + Math.random()*80;

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createLinearGradient(sx, sy, sx+Math.cos(ang)*len, sy+Math.sin(ang)*len);
      grd.addColorStop(0, `hsla(${hue},100%,85%,.9)`);
      grd.addColorStop(1, `hsla(${hue},100%,60%,0)`);
      ctx.strokeStyle = grd; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(ang)*len, sy+Math.sin(ang)*len);
      ctx.stroke(); ctx.restore();
    }

    requestAnimationFrame(tick);
  }

  function boot(){
    resize(); initStars(); initArms();
    window.addEventListener('resize', ()=>{ resize(); initStars(); initArms(); });
    requestAnimationFrame(tick);
  }

  boot();
})();
