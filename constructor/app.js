/* Конструктор фигурки — логика. Детали и настройки: constructor/parts.js */
(() => {
  const P = window.FIG_PARTS, C = window.FIG_CONFIG;
  const CATS = P.categories;
  const cat = key => CATS.find(c => c.key === key);
  const $ = id => document.getElementById(id);

  /* ---------- цвета ---------- */
  function shade(hex, amt) { // amt -1..1: <0 темнее, >0 светлее
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const colorOf = (c, id) => (c.colors || []).find(x => x.id === id) || (c.colors || [])[0];
  const optOf = (c, id) => (c.options || []).find(o => o.id === id);

  /* ---------- состояние ---------- */
  // ключи в ссылке: <key> = деталь, <key>C = цвет; acc = через запятую; text
  function defaults() {
    const s = {};
    for (const c of CATS) {
      if (c.text) s[c.key] = "";
      else if (c.multi) s[c.key] = [];
      else if (c.options) s[c.key] = c.default || c.options[0].id;
      if (c.colors) s[c.key + "C"] = c.defaultColor || c.colors[0].id;
    }
    return s;
  }
  let state = defaults();

  function hidden(key) { // категория скрыта другой деталью (платье прячет низ)
    for (const c of CATS) {
      if (!c.options || c.multi) continue;
      const o = optOf(c, state[c.key]);
      if (o && o.hides && o.hides.includes(key)) return o;
    }
    return null;
  }

  function toHash() {
    const p = new URLSearchParams();
    for (const c of CATS) {
      if (c.text) { if (state[c.key]) p.set(c.key, state[c.key]); }
      else if (c.multi) { if (state[c.key].length) p.set(c.key, state[c.key].join(",")); }
      else if (c.options) p.set(c.key, state[c.key]);
      if (c.colors) p.set(c.key + "C", state[c.key + "C"]);
    }
    return p.toString();
  }
  function fromHash() {
    const s = defaults();
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    for (const c of CATS) {
      const v = p.get(c.key);
      if (v != null) {
        if (c.text) s[c.key] = v.slice(0, c.maxLength || 24);
        else if (c.multi) s[c.key] = v.split(",").filter(id => optOf(c, id));
        else if (optOf(c, v)) s[c.key] = v;
      }
      const cv = p.get(c.key + "C");
      if (c.colors && cv && c.colors.some(x => x.id === cv)) s[c.key + "C"] = cv;
    }
    return s;
  }
  function saveHash() { history.replaceState(null, "", "#" + toHash()); }

  /* ---------- рисунок ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function fill(tpl, ctx, colorId) {
    if (typeof tpl === "object" && tpl.img) {
      const href = tpl.img.replace("{color}", colorId || "");
      return `<image href="${esc(href)}" x="0" y="0" width="${P.width}" height="${P.height}" preserveAspectRatio="none"/>`;
    }
    return tpl.replace(/\{(c|cd|cl|skin|skinD|hair|hairD)\}/g, (_, k) => ctx[k]);
  }

  function buildSVG() {
    const skin = colorOf(cat("skin"), state.skinC).hex;
    const hairHex = colorOf(cat("hair"), state.hairC).hex;
    const common = { skin, skinD: shade(skin, -0.22), hair: hairHex, hairD: shade(hairHex, -0.3) };
    const out = {}; P.layers.forEach(l => (out[l.id] = ""));
    let dx = 0;

    const add = (layers, hex, colorId) => {
      const ctx = Object.assign({}, common, hex ? { c: hex, cd: shade(hex, -0.25), cl: shade(hex, 0.3) } : { c: skin, cd: common.skinD, cl: shade(skin, 0.3) });
      for (const k in layers) if (k in out) out[k] += fill(layers[k], ctx, colorId);
    };
    add(P.base.layers, null);

    for (const c of CATS) {
      if (!c.options || hidden(c.key)) continue;
      const col = c.colors ? colorOf(c, state[c.key + "C"]) : null;
      const ids = c.multi ? state[c.key] : [state[c.key]];
      for (const id of ids) {
        const o = optOf(c, id); if (!o) continue;
        add(o.layers || {}, col && col.hex, col && col.id);
        if (o.shiftFigure) dx += o.shiftFigure;
      }
    }

    // надпись на подставке
    const txt = (state.text || "").trim();
    if (txt) {
      const fs = Math.min(13, Math.max(7, 220 / (txt.length * 0.6)));
      out.label += `<text x="150" y="${(402 + fs * 0.35).toFixed(1)}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${fs.toFixed(1)}" letter-spacing=".4" fill="#3a3330" stroke="none">${esc(txt)}</text>`;
    }

    let body = "";
    for (const l of P.layers) {
      if (!out[l.id]) continue;
      const tr = l.figure && dx ? ` transform="translate(${dx},0)"` : "";
      body += `<g data-layer="${l.id}"${tr} stroke="${P.outline}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${out[l.id]}</g>`;
    }
    return body;
  }

  /* ---------- режим «Рисунок» (p5.brush, см. constructor/brush.js) ---------- */
  // «Схема» — чёткий SVG как есть; «Рисунок» — тот же SVG, перерисованный кистями.
  const BR = window.FIG_BRUSH;
  let mode = "brush", brushOK = !!BR, paintT = 0, painted = false, paintedSVG = "";
  try { if (localStorage.getItem("figMode") === "svg") mode = "svg"; } catch (_) {}
  // зерно случайности — из сборки без надписи: пока печатают текст, штрихи не «прыгают»
  const seedOf = () => toHash().replace(/(^|&)text=[^&]*/, "");
  function previewDensity() {
    const h = $("fig").getBoundingClientRect().height || $("paint").getBoundingClientRect().height || P.height;
    const d = (window.devicePixelRatio || 1) * h / P.height;
    return Math.max(1, Math.min(2.5, Math.round(d * 2) / 2));
  }
  let density = 0;
  function showMode() {
    const brush = mode === "brush" && brushOK;
    // пока первый рисунок не готов — показываем схему, без пустого кадра
    $("paint").hidden = !(brush && painted);
    $("fig").style.display = brush && painted ? "none" : "";
    document.querySelectorAll("#mode [data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === (brushOK ? mode : "svg"))));
  }
  function fallback(err) {
    if (err) console.warn("Рисунок недоступен, показываю схему:", err);
    brushOK = false; $("mode").hidden = true; showMode();
  }
  async function paintNow() {
    if (!brushOK || mode !== "brush") return;
    if (!density) density = previewDensity();
    try {
      const svg = $("fig").innerHTML;
      const cv = await BR.render(svg, { width: P.width, height: P.height, density, seed: seedOf() });
      if (!cv || mode !== "brush") return; // отменено более свежим запросом или режим уже другой
      const out = $("paint");
      if (out.width !== cv.width || out.height !== cv.height) { out.width = cv.width; out.height = cv.height; }
      out.getContext("2d").drawImage(cv, 0, 0);
      painted = true; paintedSVG = svg; showMode();
    } catch (e) { fallback(e); }
  }
  function schedulePaint() {
    if (!brushOK || mode !== "brush") return;
    clearTimeout(paintT); paintT = setTimeout(paintNow, painted ? 150 : 0);
  }
  $("mode").addEventListener("click", e => {
    const b = e.target.closest("[data-mode]"); if (!b || !brushOK) return;
    mode = b.dataset.mode;
    try { localStorage.setItem("figMode", mode); } catch (_) {}
    // пока были на «Схеме», сборка могла поменяться — старый рисунок не показываем
    if (mode === "brush" && paintedSVG !== $("fig").innerHTML) painted = false;
    showMode(); schedulePaint();
  });
  if (brushOK) {
    $("mode").hidden = false; showMode();
    BR.load().catch(fallback); // библиотека грузится в фоне, пока видна схема
  }

  /* ---------- тексты: заказ, промпт, цена ---------- */
  function price() {
    const pr = C.price; let sum = pr.base;
    for (const c of CATS) {
      if (!c.options || hidden(c.key)) continue;
      const ids = c.multi ? state[c.key] : [state[c.key]];
      for (const id of ids) {
        const o = optOf(c, id); if (!o) continue;
        if (o.price != null) sum += o.price;
        else if (c.key === "acc") sum += pr.accessory;
        else if (c.key === "pet" && o.id !== "none") sum += pr.pet;
      }
    }
    if (pr.standText && state.text && state.text.trim()) sum += pr.standText;
    return sum;
  }
  const money = n => n.toLocaleString("ru-RU") + " " + C.price.currency;
  const priceText = () => money(price()) + (state.pet && state.pet !== "none" ? " + питомец (цену уточняйте в личных сообщениях)" : "");

  function summaryLines() {
    const L = [];
    for (const c of CATS) {
      if (c.text) { if (state.text.trim()) L.push(`${c.title}: «${state.text.trim()}»`); continue; }
      if (hidden(c.key)) continue;
      const col = c.colors ? colorOf(c, state[c.key + "C"]) : null;
      if (!c.options) { L.push(`${c.tab}: ${col.label}`); continue; }
      if (c.multi) { L.push(`${c.tab}: ${state[c.key].length ? state[c.key].map(id => optOf(c, id).label).join(", ") : "нет"}`); continue; }
      const o = optOf(c, state[c.key]);
      if (c.key === "pet" && o.id === "none") { L.push(`${c.title}: нет`); continue; }
      if (c.key === "hair" && o.id === "bald") { L.push(`${c.tab}: ${o.label}`); continue; }
      L.push(`${c.key === "pet" ? c.title : c.tab}: ${o.label}${col ? (c.key === "hair" ? ", " + col.label : ", " + (c.colorWord || "цвет") + " — " + col.label) : ""}`);
    }
    return L;
  }

  function shareURL() { return location.href.split("#")[0] + "#" + toHash(); }

  function orderText() {
    const L = ["Здравствуйте! Хочу заказать фигурку:", ""];
    summaryLines().forEach(l => L.push("• " + l));
    L.push("", `Ориентировочная цена: ${priceText()}`);
    const cm = $("oComment").value.trim();
    if (cm) L.push("", "Комментарий: " + cm);
    if ($("oPhoto").checked) L.push("", "Фото для образца пришлю в чат.");
    L.push("", "Моя сборка в конструкторе: " + shareURL());
    return L.join("\n");
  }

  const art = w => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  function promptText() {
    const g = k => optOf(cat(k), state[k]);
    const gc = k => colorOf(cat(k), state[k + "C"]);
    const parts = [C.prompt.prefix];
    const hair = g("hair");
    const hairDesc = hair.id === "bald" ? "a bald head" : `${gc("hair").en} ${hair.en}`;
    parts.push(`The character has ${colorOf(cat("skin"), state.skinC).en} skin and ${hairDesc}.`);
    const top = g("top"), wear = [art(`${gc("top").en} ${top.en}`)];
    if (!hidden("bottom")) { const b = g("bottom"); const d = `${gc("bottom").en} ${b.en}`; wear.push(b.plural ? d : art(d)); }
    wear.push(`${gc("shoes").en} ${g("shoes").en}`);
    parts.push(`Wearing ${wear.slice(0, -1).join(", ")} and ${wear[wear.length - 1]}.`);
    if (state.acc.length) parts.push(`Accessories: ${state.acc.map(id => optOf(cat("acc"), id).en).join(", ")}.`);
    const pet = g("pet");
    if (pet.id !== "none") parts.push(`A small ${gc("pet").en} ${pet.en} in the same chibi figurine style sits on the base next to the character.`);
    parts.push(C.prompt.suffix);
    if (state.text.trim()) parts.push(`The front edge of the base has the engraved text "${state.text.trim()}".`);
    return parts.join(" ");
  }

  /* ---------- интерфейс ---------- */
  let activeTab = CATS[0].key;

  function renderTabs() {
    $("tabs").innerHTML = CATS.map(c =>
      `<button type="button" role="tab" data-tab="${c.key}" aria-selected="${c.key === activeTab}">${c.tab}</button>`).join("");
  }

  function renderPanel() {
    const c = cat(activeTab); let h = "";
    const hid = hidden(c.key);
    if (hid) h += `<p class="note">Скрыто: выбран верх «${hid.label}». Поменяйте верх, чтобы выбрать низ.</p>`;
    if (c.text) {
      h += `<h2>${c.title}</h2><label class="field"><span>До ${c.maxLength} символов, появится на подставке</span>
        <input id="txt" type="text" maxlength="${c.maxLength}" placeholder="${esc(c.placeholder || "")}" value="${esc(state.text)}"></label>`;
    }
    if (c.options && !hid) {
      h += `<h2>${c.title}</h2>${c.hint ? `<p class="note">${c.hint}</p>` : ""}<div class="opts">` +
        c.options.map(o => {
          const on = c.multi ? state[c.key].includes(o.id) : state[c.key] === o.id;
          return `<button type="button" data-opt="${o.id}" aria-pressed="${on}">${o.label}</button>`;
        }).join("") + "</div>";
    }
    const showColors = c.colors && !hid && !(c.key === "hair" && state.hair === "bald") && !(c.key === "pet" && state.pet === "none");
    if (showColors) {
      const cur = colorOf(c, state[c.key + "C"]);
      h += `<h2>${c.colorTitle || c.title}: <span class="cname">${cur.label}</span></h2><div class="sw">` +
        c.colors.map(x => `<button type="button" data-col="${x.id}" title="${x.label}" aria-label="${x.label}" aria-pressed="${x.id === cur.id}" style="background:${x.hex}"></button>`).join("") + "</div>";
    }
    $("panel").innerHTML = h;
    const t = $("txt");
    if (t) t.addEventListener("input", () => { state.text = t.value; update(false); });
  }

  function update(rerenderPanel = true) {
    $("fig").innerHTML = buildSVG();
    schedulePaint();
    const withPet = state.pet && state.pet !== "none";
    $("price").textContent = money(price());
    $("priceNote").textContent = withPet ? "+ питомец" : "ориентировочно";
    $("prompt").value = promptText();
    if (rerenderPanel) renderPanel();
    if (!$("order").hidden) $("oText").value = orderText();
    saveHash();
  }

  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    activeTab = b.dataset.tab; renderTabs(); renderPanel();
  });
  $("panel").addEventListener("click", e => {
    const c = cat(activeTab);
    const o = e.target.closest("[data-opt]"), col = e.target.closest("[data-col]");
    if (o) {
      const id = o.dataset.opt;
      if (c.multi) { const a = state[c.key]; state[c.key] = a.includes(id) ? a.filter(x => x !== id) : a.concat(id); }
      else state[c.key] = id;
      update();
    } else if (col) { state[c.key + "C"] = col.dataset.col; update(); }
  });

  const pick = a => a[Math.floor(Math.random() * a.length)];
  $("rand").onclick = () => {
    const keepText = state.text;
    for (const c of CATS) {
      if (c.colors) state[c.key + "C"] = pick(c.colors).id;
      if (c.multi) state[c.key] = c.options.filter(() => Math.random() < 0.25).map(o => o.id);
      else if (c.options) state[c.key] = c.key === "pet" ? (Math.random() < 0.3 ? pick(c.options.slice(1)).id : "none") : pick(c.options).id;
    }
    // чтобы реже выпадали «клоунские» сочетания: кожа и волосы — из естественных
    state.hairC = pick(["black", "dkbrown", "brown", "ginger", "lbrown", "blond", "pink"]);
    if (state.acc.includes("cap") && state.acc.includes("headphones")) state.acc = state.acc.filter(x => x !== "headphones");
    state.text = keepText;
    update();
  };
  $("reset").onclick = () => { state = defaults(); update(); };

  /* ---------- копирование ---------- */
  let toastT;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.append(ta);
      ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok;
    }
  }

  /* ---------- заказ ---------- */
  function openOrder() {
    $("order").hidden = false; document.body.classList.add("lock");
    $("oText").value = orderText(); $("oPrice").textContent = priceText();
    $("order").scrollTop = 0;
  }
  function closeOrder() { $("order").hidden = true; document.body.classList.remove("lock"); }
  document.querySelectorAll("[data-order]").forEach(b => (b.onclick = openOrder));
  $("oClose").onclick = closeOrder;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("order").hidden) closeOrder(); });
  ["oComment", "oPhoto"].forEach(id => $(id).addEventListener("input", () => ($("oText").value = orderText())));
  $("oPhoto").addEventListener("change", () => ($("oText").value = orderText()));
  $("oCopy").onclick = async () => toast((await copy(orderText())) ? "Текст заказа скопирован" : "Не удалось скопировать — выделите текст вручную");
  $("oTg").href = C.telegram; $("oAvito").href = C.avito;
  [$("oTg"), $("oAvito")].forEach(a => a.addEventListener("click", () => {
    copy(orderText()).then(ok => ok && toast("Текст скопирован — вставьте его в чат"));
  }));

  /* ---------- промпт ---------- */
  $("pCopy").onclick = async () => toast((await copy($("prompt").value)) ? "Промпт скопирован" : "Не удалось скопировать");

  /* ---------- PNG ---------- */
  async function toDataURL(url) {
    const r = await fetch(url); if (!r.ok) throw new Error(url + " " + r.status); const b = await r.blob();
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  }
  function saveBlob(blob) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "figurka.png";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function brushPNG() { // тот же рисунок (то же зерно) в 3× разрешении
    const cv = await BR.render($("fig").innerHTML, { width: P.width, height: P.height, density: 3, seed: seedOf() });
    schedulePaint(); // экспорт мог прервать отрисовку превью
    if (!cv) throw new Error("рисунок отменён");
    return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
  }
  $("png").onclick = async () => {
    if (brushOK && mode === "brush") {
      try { toast("Готовлю картинку…"); saveBlob(await brushPNG()); return; }
      catch (e) { console.error(e); } // не вышло — сохраним схему
    }
    try {
      const S = 3, W = P.width * S, H = P.height * S;
      const svg = $("fig").cloneNode(true);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      for (const im of svg.querySelectorAll("image")) { // свои картинки-детали встраиваем
        try { im.setAttribute("href", await toDataURL(im.getAttribute("href"))); } catch (_) {}
      }
      svg.insertAdjacentHTML("afterbegin", `<rect width="100%" height="100%" fill="#f0eeeb"/>`);
      const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      cv.getContext("2d").drawImage(img, 0, 0, W, H);
      cv.toBlob(saveBlob, "image/png");
    } catch (e) { console.error(e); toast("Не получилось сохранить картинку — сделайте скриншот"); }
  };

  /* ---------- старт ---------- */
  $("fig").setAttribute("viewBox", P.viewBox);
  state = fromHash();
  window.addEventListener("hashchange", () => { state = fromHash(); update(); });
  renderTabs(); update();

  // для отладки/тестов
  window.FIG = { get state() { return state; }, set state(s) { state = s; update(); }, orderText, promptText, price, toHash, fromHash, summaryLines,
    get mode() { return brushOK ? mode : "svg"; }, brushPNG, paintNow };
})();
