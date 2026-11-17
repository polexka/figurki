/* ============================================================================
   Конструктор фигурки — режим «Рисунок» (p5.brush).
   ----------------------------------------------------------------------------
   Источник правды — тот же SVG, что собирает buildSVG() из constructor/parts.js.
   Здесь SVG кладётся в скрытый <svg>, каждая фигура (path, circle, ellipse,
   rect, polygon, line, text, image) по порядку отрисовки превращается в
   точки (свой разбор d, с учётом transform через getCTM) и перерисовывается кистями p5.brush:
     • крупные заливки — плоская подложка + акварельный слой поверх;
     • мелкие детали, глаза и блики — ровной заливкой (чтобы лицо осталось
       тем же чиби: чёрные глянцевые овалы с белыми бликами);
     • контуры — карандашом, толстые цветные линии — маркером;
     • надпись на подставке и картинки-детали — обычным canvas 2D.
   Случайность зафиксирована зерном из состояния: одна и та же сборка всегда
   выглядит одинаково.

   Используется standalone-сборка p5.brush (WebGL2, без p5.js — на 1 МБ меньше
   для телефонов). Если WebGL2 нет или скрипт не загрузился — load() отдаёт
   ошибку, и app.js остаётся в режиме «Схема».
   ========================================================================== */
(() => {
  const SRC = "https://cdn.jsdelivr.net/npm/p5.brush@3.0.0/dist/brush.js";
  const NS = "http://www.w3.org/2000/svg";
  const PAPER = "#f0eeeb";

  /* ---------- загрузка библиотеки ---------- */
  let loading = null;
  function hasWebGL2() {
    try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); }
    catch (_) { return false; }
  }
  function load() {
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      if (!hasWebGL2()) return rej(new Error("WebGL2 недоступен"));
      if (window.brush && window.brush.createCanvas) return res(window.brush);
      const s = document.createElement("script");
      s.src = SRC; s.async = true; s.crossOrigin = "anonymous";
      const t = setTimeout(() => rej(new Error("p5.brush: таймаут загрузки")), 15000);
      s.onload = () => { clearTimeout(t); window.brush && window.brush.createCanvas ? res(window.brush) : rej(new Error("p5.brush не найден")); };
      s.onerror = () => { clearTimeout(t); rej(new Error("p5.brush не загрузился")); };
      document.head.append(s);
    });
    loading.catch(() => {}); // ошибку обработает вызывающий
    return loading;
  }

  /* ---------- геометрия из SVG ---------- */
  let measure = null;
  function measureSVG(W, H) {
    if (!measure) {
      measure = document.createElementNS(NS, "svg");
      measure.setAttribute("aria-hidden", "true");
      measure.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";
      document.body.append(measure);
    }
    measure.setAttribute("width", W); measure.setAttribute("height", H);
    measure.setAttribute("viewBox", `0 0 ${W} ${H}`);
    return measure;
  }

  function parseColor(s) { // "rgb(1, 2, 3)" | "rgba(...)" | "#abc" → {r,g,b,a} | null
    if (!s || s === "none" || s === "transparent") return null;
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&");
      const n = parseInt(h, 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    return null;
  }
  const hex = c => "#" + ((1 << 24) | (c.r << 16) | (c.g << 8) | c.b).toString(16).slice(1);
  const lum = c => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const mix = (c, t, p) => ({ r: Math.round(c.r + (t.r - c.r) * p), g: Math.round(c.g + (t.g - c.g) * p), b: Math.round(c.b + (t.b - c.b) * p), a: c.a });

  function area(pts) {
    let s = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    return Math.abs(s / 2);
  }

  // убрать почти совпадающие точки (кисти не любят нулевые отрезки)
  function dedupe(pts, eps = 0.25) {
    const out = [];
    for (const p of pts) {
      const q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
    }
    return out;
  }

  function ellipsePts(cx, cy, rx, ry) {
    const L = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const n = Math.max(14, Math.min(72, Math.round(L / 2)));
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  }
  function rectPts(x, y, w, h, rx, ry) {
    if (!rx && !ry) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    rx = Math.min(rx || ry, w / 2); ry = Math.min(ry || rx, h / 2);
    const out = [], n = Math.max(4, Math.round((rx + ry) / 3));
    const corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } };
    corner(x + w - rx, y + ry, -Math.PI / 2);
    corner(x + w - rx, y + h - ry, 0);
    corner(x + rx, y + h - ry, Math.PI / 2);
    corner(x + rx, y + ry, Math.PI);
    return out;
  }

  // путь → подпути [{pts, closed}] в координатах самого элемента.
  // Свой разбор d (M L H V C S Q T A Z, абсолютные и относительные): в разы быстрее
  // getPointAtLength, особенно в Safari.
  function flattenPath(d) {
    const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, cur = null, prev = "";
    const num = () => parseFloat(toks[i++]);
    const flag = () => { // флаги дуги могут быть слитны: "a10 10 0 01 5 5"
      const t = toks[i];
      if (t.length > 1 && (t[0] === "0" || t[0] === "1") && !t.includes(".")) { toks[i] = t.slice(1); return +t[0]; }
      i++; return +t;
    };
    const push = (px, py) => cur.pts.push([px, py]);
    const segs = (len) => Math.max(2, Math.min(48, Math.ceil(len / 2.5)));
    const cubic = (x1, y1, x2, y2, x3, y3) => {
      const n = segs(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
      }
    };
    const quad = (x1, y1, x2, y2) => {
      const n = segs(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1));
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; push(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2); }
    };
    const arc = (rx, ry, phi, fa, fs, x2, y2) => {
      if (!rx || !ry) { push(x2, y2); return; }
      rx = Math.abs(rx); ry = Math.abs(ry);
      const cp = Math.cos(phi * Math.PI / 180), sp = Math.sin(phi * Math.PI / 180);
      const dx = (x - x2) / 2, dy = (y - y2) / 2;
      const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
      const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
      if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
      const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
      let co = Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
      if (fa === fs) co = -co;
      const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
      const ccx = cp * cxp - sp * cyp + (x + x2) / 2, ccy = sp * cxp + cp * cyp + (y + y2) / 2;
      const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
      const n = segs(Math.abs(dt) * Math.max(rx, ry));
      for (let k = 1; k <= n; k++) {
        const t = t1 + dt * k / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
        push(cp * ex - sp * ey + ccx, sp * ex + cp * ey + ccy);
      }
    };
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      else if (!cmd) { i++; continue; }
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === "Z") {
        if (cur) { cur.closed = true; x = sx; y = sy; }
        cur = null; prev = "Z"; cmd = ""; continue;
      }
      if (C === "M") {
        x = ox + num(); y = oy + num(); sx = x; sy = y;
        cur = { pts: [[x, y]], closed: false }; out.push(cur);
        cmd = rel ? "l" : "L"; prev = "M"; continue;
      }
      if (!cur) { cur = { pts: [[x, y]], closed: false }; out.push(cur); }
      if (C === "L") { x = ox + num(); y = oy + num(); push(x, y); }
      else if (C === "H") { x = ox + num(); push(x, y); }
      else if (C === "V") { y = oy + num(); push(x, y); }
      else if (C === "C") {
        const x1 = ox + num(), y1 = oy + num(); cx = ox + num(); cy = oy + num(); const x3 = ox + num(), y3 = oy + num();
        cubic(x1, y1, cx, cy, x3, y3); x = x3; y = y3;
      } else if (C === "S") {
        const x1 = /[CS]/.test(prev) ? 2 * x - cx : x, y1 = /[CS]/.test(prev) ? 2 * y - cy : y;
        cx = ox + num(); cy = oy + num(); const x3 = ox + num(), y3 = oy + num();
        cubic(x1, y1, cx, cy, x3, y3); x = x3; y = y3;
      } else if (C === "Q") {
        qx = ox + num(); qy = oy + num(); const x2 = ox + num(), y2 = oy + num();
        quad(qx, qy, x2, y2); x = x2; y = y2;
      } else if (C === "T") {
        qx = /[QT]/.test(prev) ? 2 * x - qx : x; qy = /[QT]/.test(prev) ? 2 * y - qy : y;
        const x2 = ox + num(), y2 = oy + num();
        quad(qx, qy, x2, y2); x = x2; y = y2;
      } else if (C === "A") {
        const rx = num(), ry = num(), phi = num(), fa = flag(), fs = flag(), x2 = ox + num(), y2 = oy + num();
        arc(rx, ry, phi, fa, fs, x2, y2); x = x2; y = y2;
      } else { i++; continue; }
      prev = C;
    }
    return out.map(s => ({ pts: dedupe(s.closed && s.pts.length > 2 && Math.hypot(s.pts[0][0] - s.pts[s.pts.length - 1][0], s.pts[0][1] - s.pts[s.pts.length - 1][1]) < 0.3 ? s.pts.slice(0, -1) : s.pts), closed: s.closed }))
      .filter(s => s.pts.length > 1);
  }

  function subpathsOf(el) {
    const n = el.localName, num = a => parseFloat(el.getAttribute(a)) || 0;
    switch (n) {
      case "path": return flattenPath(el.getAttribute("d") || "");
      case "circle": return [{ pts: ellipsePts(num("cx"), num("cy"), num("r"), num("r")), closed: true }];
      case "ellipse": return [{ pts: ellipsePts(num("cx"), num("cy"), num("rx"), num("ry")), closed: true }];
      case "rect": return [{ pts: rectPts(num("x"), num("y"), num("width"), num("height"), num("rx"), num("ry")), closed: true }];
      case "line": return [{ pts: [[num("x1"), num("y1")], [num("x2"), num("y2")]], closed: false }];
      case "polygon": case "polyline": {
        const v = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number), pts = [];
        for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]);
        return [{ pts, closed: n === "polygon" }];
      }
    }
    return [];
  }

  // SVG-разметка → список операций рисования по порядку
  function extract(markup, W, H) {
    const svg = measureSVG(W, H);
    svg.innerHTML = markup;
    const ops = [], gop = new Map();
    const groupOpacity = g => {
      if (g === svg) return 1;
      if (!gop.has(g)) gop.set(g, (parseFloat(getComputedStyle(g).opacity) || 0) * groupOpacity(g.parentNode));
      return gop.get(g);
    };
    // 1) сначала читаем все стили и матрицы (пока DOM не меняется — без пересчёта стилей)
    const items = [];
    const walk = (node, layer) => {
      for (const el of node.children) {
        const n = el.localName;
        const lay = el.dataset && el.dataset.layer ? el.dataset.layer : layer;
        if (n === "g") { walk(el, lay); continue; }
        const cs = getComputedStyle(el);
        if (cs.display === "none") continue;
        const op = (parseFloat(cs.opacity) || 0) * groupOpacity(el.parentNode);
        if (op <= 0.01) continue;
        const m = el.getCTM(); if (!m) continue;
        items.push({ el, n, lay, op, m: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f },
          fill: cs.fill, fillOpacity: cs.fillOpacity, stroke: cs.stroke, strokeOpacity: cs.strokeOpacity,
          strokeWidth: cs.strokeWidth, fontSize: cs.fontSize, fontFamily: cs.fontFamily });
      }
    };
    walk(svg, "");
    // 2) потом геометрия
    for (const it of items) {
      const { el, n, lay, op, m } = it;
      const tf = ([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      if (n === "text") {
        const fill = parseColor(it.fill);
        const [x, y] = tf([parseFloat(el.getAttribute("x")) || 0, parseFloat(el.getAttribute("y")) || 0]);
        ops.push({ kind: "text", layer: lay, x, y, text: el.textContent, size: parseFloat(it.fontSize) * sc,
          family: it.fontFamily, anchor: el.getAttribute("text-anchor") || "start",
          spacing: parseFloat(el.getAttribute("letter-spacing")) || 0, color: fill ? hex(fill) : "#000", alpha: op * (fill ? fill.a : 1) });
        continue;
      }
      if (n === "image") {
        const [x, y] = tf([parseFloat(el.getAttribute("x")) || 0, parseFloat(el.getAttribute("y")) || 0]);
        ops.push({ kind: "image", layer: lay, href: el.getAttribute("href") || el.getAttribute("xlink:href"), x, y,
          w: (parseFloat(el.getAttribute("width")) || W) * sc, h: (parseFloat(el.getAttribute("height")) || H) * sc, alpha: op });
        continue;
      }
      const subs = subpathsOf(el).map(s => ({ pts: s.pts.map(tf), closed: s.closed })).filter(s => s.pts.length > 1);
      if (!subs.length) continue;
      const fill = parseColor(it.fill), stroke = parseColor(it.stroke);
      const fa = fill ? op * (parseFloat(it.fillOpacity) || 0) * fill.a : 0;
      const sa = stroke ? op * (parseFloat(it.strokeOpacity) || 0) * stroke.a : 0;
      const sw = (parseFloat(it.strokeWidth) || 0) * sc;
      if (fill && fa > 0.01 && n !== "line") {
        for (const s of subs) if (s.pts.length > 2) ops.push({ kind: "fill", layer: lay, pts: s.pts, color: fill, alpha: fa, area: area(s.pts), el: n });
      }
      if (stroke && sa > 0.01 && sw > 0.1) {
        for (const s of subs) ops.push({ kind: "stroke", layer: lay, pts: s.pts, closed: s.closed || n !== "path" && n !== "line" && n !== "polyline", color: stroke, alpha: sa, width: sw });
      }
    }
    svg.innerHTML = "";
    return ops;
  }

  /* ---------- рисование ---------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const canvases = new Map(); // плотность → WebGL2-холст p5.brush
  let brushesReady = false;
  function brushCanvas(B, W, H, density) {
    let c = canvases.get(density);
    if (!c) {
      c = B.createCanvas(W, H, { pixelDensity: density, parent: null, id: "brush-" + density });
      canvases.set(density, c);
    } else B.load(c);
    if (!brushesReady) {
      // свои кисти: мягкий цветной карандаш для контура и плотный маркер
      B.add("figPencil", Object.assign({ type: "default", weight: 1, rotate: "none" }, LOOK.pencilBrush));
      B.add("figPencilSoft", Object.assign({ type: "default", weight: 1, rotate: "none" }, LOOK.pencilBrush, { opacity: LOOK.pencilBrush.opacity * 0.55 }));
      B.add("figMarker", { type: "marker", weight: 1, scatter: 0.04, opacity: 230, spacing: 0.04,
        pressure: [1, 1.05, 0.95], markerTip: false, noise: 0.15 });
      brushesReady = true;
    }
    return c;
  }

  const imgCache = new Map();
  function loadImg(href) {
    if (!imgCache.has(href)) imgCache.set(href, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = href; }));
    return imgCache.get(href);
  }

  const INK = { r: 43, g: 33, b: 29, a: 1 }, PAPER_C = parseColor(PAPER);
  // настройки «руки» — подбираются на глаз
  const LOOK = { base: 0.4, bleed: 0.04, texture: 0.6, border: 0.75, fillBig: 150, fillSmall: 170,
                 pencil: 0.78, marker: 0.5, wiggle: 0.8, scatter: false,
                 pencilBrush: { scatter: 0.3, sharpness: 0.45, grain: 4, opacity: 190, spacing: 0.15, noise: 0.3,
                                pressure: { mode: "gaussian", curve: [0.15, 0.2], min_max: [1.05, 0.85] } } };
  // у WebGL-холста p5.brush начало координат в центре — сдвигаем в угол, как в SVG
  let OX = 0, OY = 0;
  const shift = pts => pts.map(p => [p[0] - OX, p[1] - OY]);
  const isInk = c => lum(c) < 0.2;

  function drawFill(B, o) {
    const c = o.color, a = Math.round(255 * Math.min(1, o.alpha));
    const L = lum(c), dark = L < 0.09, small = o.area < 70;
    B.noStroke();
    if (dark || small || o.alpha < 0.98 || o.el === "rect" && o.area < 400) {
      // глаза, блики, румянец, тени, мелочь — ровно и чисто
      B.wash(hex(c), a); B.polygon(shift(o.pts)); B.noWash();
      return;
    }
    // подложка — светлее (как бумага сквозь краску), сверху акварель цвета детали
    const pts = shift(o.pts);
    B.wash(hex(mix(c, PAPER_C, LOOK.base * Math.min(1, Math.max(0.2, L * 2)))), 255); B.polygon(pts); B.noWash();
    B.fillBleed(LOOK.bleed, "in");
    B.fillTexture(LOOK.texture, LOOK.border, LOOK.scatter, 0.15);
    B.fill(hex(c), o.area > 4000 ? LOOK.fillBig : LOOK.fillSmall); B.polygon(pts); B.noFill();
  }

  function drawStroke(B, o) {
    const c = o.color, soft = o.alpha < 0.9;
    B.noFill(); B.noWash();
    let pts = o.pts;
    if (o.closed && pts.length > 2) pts = pts.concat([pts[0]]);
    if (o.width >= 3.2 || !isInk(c) && o.width >= 2.6) {
      // толстые цветные линии (брови, наушники, ручки, хвост) — маркером
      B.noField();
      B.set("figMarker", hex(c), o.width * LOOK.marker);
    } else {
      if (LOOK.wiggle) B.wiggle(LOOK.wiggle); else B.noField();
      const col = isInk(c) ? hex(mix(c, INK, 0.3)) : hex(c);
      B.set(soft ? "figPencilSoft" : "figPencil", col, Math.max(0.7, o.width * LOOK.pencil));
    }
    B.spline(shift(pts), 0);
  }

  function drawText(ctx, o) {
    ctx.save();
    ctx.globalAlpha = o.alpha; ctx.fillStyle = o.color;
    ctx.font = `${o.size}px ${o.family}`;
    ctx.textAlign = o.anchor === "middle" ? "center" : o.anchor === "end" ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = o.spacing + "px";
    ctx.fillText(o.text, o.x, o.y);
    ctx.restore();
  }

  let generation = 0;

  /**
   * Нарисовать SVG-разметку кистями.
   * @param {string} markup  содержимое <svg> из buildSVG()
   * @param {{width:number,height:number,density:number,seed:string}} o
   * @returns {Promise<HTMLCanvasElement|null>} готовый 2D-холст (null — если отменено новым вызовом)
   */
  async function render(markup, o) {
    const my = ++generation;
    const B = await load();
    const W = o.width, H = o.height, D = o.density;
    const t0 = performance.now();
    const ops = extract(markup, W, H);
    const t1 = performance.now();

    const out = document.createElement("canvas");
    out.width = Math.round(W * D); out.height = Math.round(H * D);
    const ctx = out.getContext("2d");
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, out.width, out.height);
    ctx.setTransform(D, 0, 0, D, 0, 0);

    const bc = brushCanvas(B, W, H, D);
    OX = W / 2; OY = H / 2;
    B.seed(hashStr(o.seed || markup)); if (B.noiseSeed) B.noiseSeed(hashStr("n" + (o.seed || markup)));
    B.clear(PAPER);
    let lastLayer = null;
    const flush = () => { // перенести накопленное кистями на 2D-холст и очистить холст кистей
      B.render();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bc, 0, 0, out.width, out.height); ctx.restore();
      // дальше рисуем на прозрачном: brush.clear() без цвета даёт «прозрачный белый»,
      // который при premultipliedAlpha превращается в белую заливку — чистим сами в (0,0,0,0)
      B.clear();
      const gl = bc.getContext("webgl2");
      if (gl) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    };
    for (const op of ops) {
      if (op.layer !== lastLayer) {
        B.render(); // акварель «высыхает» между слоями — не затекает в соседние детали
        lastLayer = op.layer;
      }
      if (op.kind === "fill") drawFill(B, op);
      else if (op.kind === "stroke") drawStroke(B, op);
      else {
        // текст и картинки — поверх уже нарисованного обычным canvas 2D
        flush();
        if (op.kind === "text") drawText(ctx, op);
        else {
          const im = await loadImg(op.href); if (my !== generation) return null; B.load(bc);
          if (im) { ctx.globalAlpha = op.alpha; ctx.drawImage(im, op.x, op.y, op.w, op.h); ctx.globalAlpha = 1; }
        }
      }
    }
    flush();
    const t2 = performance.now();
    render.last = { extractMs: +(t1 - t0).toFixed(1), totalMs: +(t2 - t0).toFixed(1), ops: ops.length, density: D };
    if (my !== generation) return null;
    return out;
  }

  window.FIG_BRUSH = { load, render, extract, SRC, LOOK, rebrush: () => (brushesReady = false) };
})();
