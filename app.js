/* ================================================================
   НАСТРОЙКИ САЙТА — всё, что нужно менять, находится здесь.
   Пустая строка "" у соцсети = ссылка не показывается на сайте.
   ================================================================ */
const CONFIG = {
  links: {
    avito:     "https://www.avito.ru/sankt-peterburg/predlozheniya_uslug/izgotovlenie_figurki_na_zakaz_7941127708",
    telegram:  "https://t.me/pi1cru",
    tgchannel: "https://t.me/kokeshiki",
    instagram: "",   // TODO: например "https://instagram.com/ваш_ник"
    tiktok:    "",   // TODO: например "https://www.tiktok.com/@ваш_ник"
  },

  /* Сроки и доставка — подставляются в блок «Сроки и доставка» и в FAQ */
  terms: {
    leadTime:  "10–14 дней",
    rushTime:  "5–10 дней (+2 000 ₽, вне очереди)",
    prepay:    "нет — оплата после согласования 3D-модели",
    delivery:  "Авито Доставка, Яндекс Доставка, Ozon или самовывоз в Санкт-Петербурге",
    deliveryTime: "по тарифам службы доставки",
    city:      "Санкт-Петербург",
  },

  /* Цены — из объявления на Авито. С 20.11.2026 прайс повышается: обновите цифры здесь. */
  tariffs: [
    { name: "Фигурка 10 см", size: "10 см", price: "4 000 ₽", hit: true,
      text: "Оригинальный размер Funko Pop. Расписана вручную, в крафтовой коробке с окошком." },
    { name: "Фигурка 7 см",  size: "7 см",  price: "3 000 ₽",
      text: "Стандартный авторский размер. Расписана вручную, в крафтовой коробке с окошком." },
    { name: "Белая 10 см",   size: "10 см", price: "2 000 ₽",
      text: "Без покраски: можно раскрасить самим или подарить как есть." },
    { name: "Белая 7 см",    size: "7 см",  price: "1 500 ₽",
      text: "Без покраски, авторский размер." },
    { name: "Пара, питомец, персонаж", size: "7–10 см и другие", price: "индивидуально",
      text: "Несколько фигурок, питомцы, герои игр и фильмов, другой размер — считаем по фото." },
  ],
  extras: [
    { name: "Срочный заказ вне очереди (5–10 дней)", price: "+ 2 000 ₽" },
    { name: "Подставка",                             price: "от 500 ₽" },
    { name: "Крепление под брелок + фурнитура",      price: "+ 500 ₽" },
    { name: "Дополнительные элементы и аксессуары",  price: "от 100 ₽" },
    { name: "Крафтовая коробка с окошком и наполнителем", price: "в подарок" },
  ],
};

/* Подписи категорий галереи (ключи — поле cat в data.js) */
const CATS = [
  ["single",    "Одиночные"],
  ["pair",      "Пары и семьи"],
  ["pet",       "С питомцами"],
  ["diorama",   "Диорамы"],
  ["character", "Персонажи"],
  ["raw",       "Без покраски"],
];

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- ссылки и подстановки из CONFIG ---------- */
  $$("[data-link]").forEach(a => {
    const url = CONFIG.links[a.dataset.link];
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; }
    else (a.closest(".olinks li") || a).remove();
  });
  $$("[data-term]").forEach(el => { el.textContent = CONFIG.terms[el.dataset.term] || "___"; });

  /* ---------- цены ---------- */
  $("#tariffs").innerHTML = CONFIG.tariffs.map(t => `
    <article class="tariff${t.hit ? " hit" : ""}">
      <div class="tname">${esc(t.name)}${t.hit ? ' <span class="tag">чаще всего</span>' : ""}</div>
      <div class="tprice${/\d/.test(t.price) ? "" : " word"}">${esc(t.price)}</div>
      <div class="tsize">высота ${esc(t.size)}</div>
      <p>${esc(t.text)}</p>
    </article>`).join("");
  $("#extras").innerHTML = CONFIG.extras.map(x =>
    `<li><span>${esc(x.name)}</span><span class="xp">${esc(x.price)}</span></li>`).join("");

  /* ---------- первый экран: лучшие работы ---------- */
  const best = PHOTOS.map((p, i) => ({ p, i })).filter(o => o.p.best)
                     .sort((a, b) => a.p.best - b.p.best);
  /* рукописная подпись под полароидом — по категории работы */
  const note = c => c.includes("pet") ? "с питомцем ♡"
    : c.includes("pair") && c.includes("diorama") ? "вся компания"
    : c.includes("diorama") ? "целая сценка"
    : c.includes("pair") ? "вдвоём ♡"
    : c.includes("character") ? "любимый герой"
    : c.includes("raw") ? "ещё без красок" : "мини-копия ♡";
  $("#heroPics").innerHTML = best.slice(0, 4).map((o, k) => `
    <button class="hp" data-idx="${o.i}" aria-label="Открыть фото работы">
      <span class="tape" aria-hidden="true"></span>
      <img src="${o.p.t || o.p.f}" alt="Фигурка на заказ по фото — пример работы"
           width="${o.p.w}" height="${o.p.h}" ${k ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
      <span class="cap" aria-hidden="true">${note(o.p.cat || [])}</span>
    </button>`).join("");
  $$("#heroPics .hp").forEach(b => b.addEventListener("click", () => openLb(+b.dataset.idx, best.map(o => o.i))));
  $("#workCount").textContent = PHOTOS.length;

  /* ---------- галерея ---------- */
  const grid = $("#grid");
  PHOTOS.forEach((p, idx) => {
    const d = document.createElement("button");
    d.className = "ph"; d.dataset.idx = idx; d.setAttribute("aria-label", "Открыть фото");
    const img = document.createElement("img");
    img.loading = "lazy"; img.decoding = "async"; img.src = p.t || p.f;
    img.width = p.w; img.height = p.h;
    img.alt = "Фигурка по фото: " + (p.cat || []).map(c => (CATS.find(x => x[0] === c) || [, ""])[1].toLowerCase()).filter(Boolean).join(", ");
    d.append(img);
    if (p.kind === "video") { const pl = document.createElement("div"); pl.className = "play"; d.append(pl); }
    d.addEventListener("click", () => openLb(idx, visible()));
    grid.append(d);
  });

  /* фильтры — только категории, в которых реально есть работы */
  const count = c => PHOTOS.filter(p => (p.cat || []).includes(c)).length;
  const chips = [["all", "Все", PHOTOS.length], ...CATS.map(([k, l]) => [k, l, count(k)]).filter(c => c[2])];
  $("#chips").innerHTML = chips.map(([k, l, n], i) =>
    `<button class="chip" data-cat="${k}" aria-pressed="${i === 0}">${l} <sup>${n}</sup></button>`).join("");
  let cur = "all";
  $$("#chips .chip").forEach(b => b.addEventListener("click", () => {
    cur = b.dataset.cat;
    $$("#chips .chip").forEach(x => x.setAttribute("aria-pressed", x === b));
    for (const el of grid.children) {
      const p = PHOTOS[+el.dataset.idx];
      el.hidden = !(cur === "all" || (p.cat || []).includes(cur));
    }
    relayout();
  }));
  const visible = () => [...grid.children].filter(el => !el.hidden).map(el => +el.dataset.idx);

  /* masonry: строка сетки 2px без зазора; высота ячейки = пропорция фото
     + белая рамка (padding) + отступ снизу (margin-bottom) */
  const ROWPX = 2;
  function relayout() {
    const first = [...grid.children].find(el => !el.hidden);
    if (!first) return;
    const cs = getComputedStyle(first);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const mb = parseFloat(cs.marginBottom) || 0;
    const iw = first.getBoundingClientRect().width - padX;
    for (const el of grid.children) {
      if (el.hidden) continue;
      const p = PHOTOS[+el.dataset.idx];
      const ratio = (p.h || 960) / (p.w || 720);
      const span = Math.max(2, Math.round((iw * ratio + padY + mb) / ROWPX));
      el.style.gridRowEnd = "span " + span;
    }
  }
  relayout();
  let rsT;
  window.addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(relayout, 120); });

  /* ---------- лайтбокс ---------- */
  const lb = $("#lb");
  let list = [], pos = 0, lastFocus = null;
  function show() {
    const i = list[pos], p = PHOTOS[i];
    $("#lbmedia").innerHTML = (p.kind === "video" && p.embed)
      ? `<iframe src="${p.embed}" allow="autoplay; fullscreen" allowfullscreen></iframe>`
      : `<img src="${p.f}" alt="">`;
    $("#lbcap").textContent = (p.cat || []).map(c => (CATS.find(x => x[0] === c) || [, ""])[1]).filter(Boolean).join(" · ");
    $("#count").textContent = (pos + 1) + " / " + list.length;
  }
  function openLb(i, l) {
    list = l && l.length ? l : PHOTOS.map((_, k) => k);
    pos = Math.max(0, list.indexOf(i));
    lastFocus = document.activeElement;
    show();
    lb.style.display = "flex"; document.documentElement.classList.add("lbopen");
    $("#close").focus();
  }
  function closeLb() {
    lb.style.display = "none"; $("#lbmedia").innerHTML = "";
    document.documentElement.classList.remove("lbopen");
    if (lastFocus) lastFocus.focus();
  }
  const step = d => { pos = (pos + d + list.length) % list.length; show(); };
  $("#close").onclick = closeLb;
  $("#prev").onclick = () => step(-1);
  $("#next").onclick = () => step(1);
  document.addEventListener("keydown", e => {
    if (lb.style.display !== "flex") return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  let tx = null;
  lb.addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  /* ---------- мобильное меню ---------- */
  const menuBtn = $("#menuBtn"), nav = $("#nav");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.textContent = open ? "Закрыть" : "Меню";
  });
  $$("#nav a").forEach(a => a.addEventListener("click", () => {
    nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); menuBtn.textContent = "Меню";
  }));

  document.getElementById("year").textContent = new Date().getFullYear();
})();
