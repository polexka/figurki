/* ============================================================================
   Конструктор фигурки — настройки и детали (parts).
   ----------------------------------------------------------------------------
   FIG_CONFIG — ссылки, цены, текст промпта.   <<< ЗАПОЛНИТЬ (см. «ЗАГЛУШКА»)
   FIG_PARTS  — всё, из чего рисуется фигурка.

   КАК УСТРОЕН РИСУНОК
   Холст 300 x 416 (viewBox "0 0 300 416"). Фигурка стоит по центру (x = 150),
   ступни на y ~ 364, подставка — эллипс с центром (150, 368).
   Рисунок собирается из слоёв, снизу вверх — порядок в FIG_PARTS.layers:
     stand, hairBack, body, bottoms, shoes, top, accMid, head, face,
     hairFront, accFront, pet, label
   Слой label (надпись на ребре подставки) рисует сам скрипт из текстового поля.

   ФОРМАТ ДЕТАЛИ (option)
     { id: "bob",                 // латиница, попадает в ссылку (#...)
       label: "каре",             // как видит покупатель
       en: "bob haircut ...",     // для английского промпта
       price: 0,                  // необязательно: доплата за эту деталь, ₽
       hides: ["bottom"],         // необязательно: скрыть другие категории (платье прячет низ)
       layers: {                  // какой слой чем рисовать
         hairBack:  '<path d="..." fill="{c}"/>',          // SVG-фрагмент, ИЛИ
         hairFront: { img: "constructor/parts/bob-front-{color}.png" }  // картинка
       } }

   В SVG-фрагментах подставляются цвета:
     {c} {cd} {cl}  — выбранный цвет детали, темнее, светлее
     {skin} {skinD} — цвет кожи и тень кожи
     {hair} {hairD} — цвет волос и темнее
   По умолчанию у каждого слоя тёмный контур 2px; fill="..." задавайте всегда,
   stroke="none" — убрать контур у фигуры.

   КАК ЗАМЕНИТЬ НА СВОИ НАРИСОВАННЫЕ ДЕТАЛИ
   1. Нарисуйте деталь на прозрачном холсте 300x416 (или кратном: 600x832,
      900x1248) так, чтобы она стояла на своём месте относительно фигурки —
      проще всего положить скриншот конструктора подложкой.
   2. Сохраните PNG/SVG в папку constructor/parts/.
   3. Замените строку слоя на { img: "constructor/parts/имя.png" }.
      Картинки не перекрашиваются: если нужны цвета, сделайте файл на каждый
      цвет и укажите {color} в имени — подставится id цвета
      (например hair-bob-front-black.png, hair-bob-front-blond.png ...).
   ========================================================================== */

window.FIG_CONFIG = {
  // ЗАГЛУШКА: ссылка на ваш Telegram (личка или бот), например "https://t.me/username"
  telegram: "https://t.me/pi1cru",
  avito: "https://www.avito.ru/sankt-peterburg/predlozheniya_uslug/izgotovlenie_figurki_na_zakaz_7941127708",

  // Цены из объявления на Авито (до повышения 20.11.2026 — обновите здесь).
  // Базовая цена берётся из вкладки «Размер» (у каждого варианта свой price).
  price: {
    base: 0,
    accessory: 100,    // «дополнительные элементы — от 100 ₽» (если у детали нет своего price)
    pet: 0,            // цена питомца — «уточняйте в личных сообщениях» (см. priceText в app.js)
    standText: 500,    // подставка с надписью — «от 500 ₽»
    currency: "₽",
    note: "ориентировочно, точную цену назовём после обсуждения",
  },

  // Текст для генератора картинок (Midjourney / GPT / и т.п.) перед Meshy.
  prompt: {
    prefix: "Full-body front view of a cute chibi collectible figurine in the style of a Funko Pop vinyl toy, 3D-printed and hand-painted. Oversized rounded head, large glossy solid black oval eyes with small white highlights, tiny nose, no mouth, simple eyebrows, small compact body with short arms and legs, chunky sculpted hair with big smooth strands.",
    suffix: "Standing on a round clear acrylic base. Clean simple sculptable shapes, matte acrylic paint finish, soft studio lighting, plain light warm-grey background, centered, no text other than on the base, suitable for image-to-3D model generation.",
  },
};

(function () {
  /* ---------- общие формы тела (одинаковы для всех фигурок) ---------- */
  const TORSO = '<path d="M118,236 C128,231 172,231 182,236 L187,304 L113,304 Z" fill="{c}"/>';
  const SLEEVES_SHORT =
    '<path d="M121,237 C109,240 102,252 100,268 L116,270 C117,260 119,252 124,248 Z" fill="{c}"/>' +
    '<path d="M179,237 C191,240 198,252 200,268 L184,270 C183,260 181,252 176,248 Z" fill="{c}"/>';
  const SLEEVES_LONG =
    '<path d="M121,237 C109,240 101,258 99,290 L115,292 C116,272 119,258 124,250 Z" fill="{c}"/>' +
    '<path d="M179,237 C191,240 199,258 201,290 L185,292 C184,272 181,258 176,250 Z" fill="{c}"/>';
  const PANTS = '<path d="M117,298 L183,298 L178,350 L153,350 L150,318 L147,350 L122,350 Z" fill="{c}"/>';

  /* кудри — набор кружков по дуге */
  function curls(cx, cy, rx, ry, a0, a1, n, r, fill) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const a = (a0 + (a1 - a0) * (i / (n - 1))) * Math.PI;
      const x = (cx + rx * Math.cos(a)).toFixed(1), y = (cy + ry * Math.sin(a)).toFixed(1);
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
    }
    return s;
  }

  /* ---------- палитры ---------- */
  const SKIN = [
    { id: "porcelain", label: "фарфоровая", hex: "#fbe4d5", en: "very fair porcelain" },
    { id: "light",     label: "светлая",    hex: "#f5d0b5", en: "fair" },
    { id: "beige",     label: "бежевая",    hex: "#e9bd98", en: "light beige" },
    { id: "olive",     label: "оливковая",  hex: "#d09f74", en: "warm olive" },
    { id: "tan",       label: "смуглая",    hex: "#ac774f", en: "tan brown" },
    { id: "dark",      label: "тёмная",     hex: "#77492f", en: "deep dark brown" },
  ];
  const HAIR = [
    { id: "black",   label: "чёрные",          hex: "#231d1b", en: "jet black" },
    { id: "dkbrown", label: "тёмно-каштановые", hex: "#4a2f22", en: "dark brown" },
    { id: "brown",   label: "каштановые",      hex: "#7b4a2e", en: "chestnut brown" },
    { id: "ginger",  label: "рыжие",           hex: "#c9622b", en: "ginger red" },
    { id: "lbrown",  label: "русые",           hex: "#a8835c", en: "light ash brown" },
    { id: "blond",   label: "светлые",         hex: "#e3c486", en: "golden blonde" },
    { id: "grey",    label: "седые",           hex: "#c9c6c1", en: "silver grey" },
    { id: "pink",    label: "розовые",         hex: "#ef9fbd", en: "pastel pink" },
    { id: "blue",    label: "голубые",         hex: "#7fb4e0", en: "pastel blue" },
  ];
  const CLOTH = [
    { id: "white",  label: "белый",      hex: "#f7f5f0", en: "white" },
    { id: "black",  label: "чёрный",     hex: "#2a2726", en: "black" },
    { id: "grey",   label: "серый",      hex: "#9b9a98", en: "grey" },
    { id: "beige",  label: "бежевый",    hex: "#d9c3a3", en: "beige" },
    { id: "brown",  label: "коричневый", hex: "#7a5236", en: "brown" },
    { id: "red",    label: "красный",    hex: "#c8372d", en: "red" },
    { id: "wine",   label: "бордовый",   hex: "#7c2634", en: "burgundy" },
    { id: "pink",   label: "розовый",    hex: "#f2a9bb", en: "pink" },
    { id: "yellow", label: "жёлтый",     hex: "#f0c64a", en: "mustard yellow" },
    { id: "green",  label: "зелёный",    hex: "#5d8b55", en: "green" },
    { id: "mint",   label: "мятный",     hex: "#9fd6c2", en: "mint green" },
    { id: "teal",   label: "бирюзовый",  hex: "#3f9a9c", en: "teal" },
    { id: "sky",    label: "голубой",    hex: "#9cc6e6", en: "light blue" },
    { id: "denim",  label: "джинсовый",  hex: "#5a7ea6", en: "denim blue" },
    { id: "navy",   label: "синий",      hex: "#2c4a86", en: "navy blue" },
    { id: "purple", label: "фиолетовый", hex: "#8a6bb0", en: "lavender purple" },
  ];
  const PET = [
    { id: "ginger", label: "рыжий",      hex: "#e08b3d", en: "ginger" },
    { id: "grey",   label: "серый",      hex: "#8f8f8f", en: "grey" },
    { id: "black",  label: "чёрный",     hex: "#2b2928", en: "black" },
    { id: "white",  label: "белый",      hex: "#f6f3ee", en: "white" },
    { id: "brown",  label: "коричневый", hex: "#8a5a3a", en: "brown" },
    { id: "cream",  label: "кремовый",   hex: "#ead4a9", en: "cream" },
  ];

  window.FIG_PARTS = {
    viewBox: "0 0 300 416",
    width: 300, height: 416,
    outline: "#2b211d",

    // порядок слоёв снизу вверх; figure: true — слой сдвигается вместе с фигуркой
    layers: [
      { id: "stand" },
      { id: "hairBack", figure: true },
      { id: "body", figure: true },
      { id: "bottoms", figure: true },
      { id: "shoes", figure: true },
      { id: "top", figure: true },
      { id: "accMid", figure: true },
      { id: "head", figure: true },
      { id: "face", figure: true },
      { id: "hairFront", figure: true },
      { id: "accFront", figure: true },
      { id: "pet" },
      { id: "label" },
    ],

    /* База — рисуется всегда. {c} здесь = цвет кожи. */
    base: {
      layers: {
        stand:
          '<path d="M22,368 L22,390 A128,22 0 0 0 278,390 L278,368 Z" fill="#dcd8d2" stroke="#000" stroke-width="1.5"/>' +
          '<ellipse cx="150" cy="368" rx="128" ry="22" fill="#eeebe6" stroke="#000" stroke-width="1.5"/>' +
          '<ellipse cx="150" cy="368" rx="110" ry="15" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>',
        body:
          '<ellipse cx="150" cy="365" rx="44" ry="6" fill="#000" opacity=".13" stroke="none"/>' +
          '<rect x="140" y="210" width="20" height="30" fill="{skin}"/>' +
          '<path d="M121,238 C109,242 102,260 100,292 L114,294 C115,274 118,258 124,250 Z" fill="{skin}"/>' +
          '<path d="M179,238 C191,242 198,260 200,292 L186,294 C185,274 182,258 176,250 Z" fill="{skin}"/>' +
          '<circle cx="107" cy="298" r="8.5" fill="{skin}"/><circle cx="193" cy="298" r="8.5" fill="{skin}"/>' +
          '<path d="M124,300 L148,300 L147,354 L126,354 Z" fill="{skin}"/>' +
          '<path d="M152,300 L176,300 L174,354 L153,354 Z" fill="{skin}"/>',
        head:
          '<ellipse cx="63" cy="154" rx="10" ry="14" fill="{skin}"/>' +
          '<ellipse cx="237" cy="154" rx="10" ry="14" fill="{skin}"/>' +
          '<rect x="62" y="56" width="176" height="166" rx="74" ry="70" fill="{skin}"/>' +
          '<path d="M78,196 C100,222 200,222 222,196" fill="none" stroke="{skinD}" stroke-width="2" opacity=".35"/>',
        face:
          '<g stroke="none">' +
          '<ellipse cx="104" cy="186" rx="11" ry="6" fill="#f09a96" opacity=".4"/>' +
          '<ellipse cx="196" cy="186" rx="11" ry="6" fill="#f09a96" opacity=".4"/>' +
          '<ellipse cx="114" cy="158" rx="15" ry="18" fill="#141111"/>' +
          '<ellipse cx="186" cy="158" rx="15" ry="18" fill="#141111"/>' +
          '<circle cx="119.5" cy="151" r="4.6" fill="#fff"/><circle cx="191.5" cy="151" r="4.6" fill="#fff"/>' +
          '<circle cx="109" cy="166" r="2" fill="#fff" opacity=".8"/><circle cx="181" cy="166" r="2" fill="#fff" opacity=".8"/>' +
          '<ellipse cx="150" cy="180" rx="4.5" ry="3.2" fill="{skinD}"/>' +
          '</g>' +
          '<path d="M100,133 Q114,126 128,132" fill="none" stroke="{hair}" stroke-width="4.5"/>' +
          '<path d="M172,132 Q186,126 200,133" fill="none" stroke="{hair}" stroke-width="4.5"/>',
      },
    },

    categories: [
      /* ---------------- Размер и покрас ---------------- */
      {
        key: "size", tab: "Размер", title: "Размер и покрас", default: "c10",
        options: [
          { id: "c10", label: "10 см, цветная — 4 000 ₽", short: "10 см, расписана вручную", price: 4000, en: "", layers: {} },
          { id: "c7",  label: "7 см, цветная — 3 000 ₽",  short: "7 см, расписана вручную",  price: 3000, en: "", layers: {} },
          { id: "w10", label: "10 см, белая — 2 000 ₽",   short: "10 см, белая без покраски", price: 2000, en: "", layers: {} },
          { id: "w7",  label: "7 см, белая — 1 500 ₽",    short: "7 см, белая без покраски",  price: 1500, en: "", layers: {} },
        ],
      },

      /* ---------------- Кожа ---------------- */
      { key: "skin", tab: "Кожа", title: "Тон кожи", colors: SKIN, defaultColor: "light" },

      /* ---------------- Причёска ---------------- */
      {
        key: "hair", tab: "Причёска", title: "Причёска", colorTitle: "Цвет волос",
        colors: HAIR, defaultColor: "dkbrown", default: "bob",
        options: [
          { id: "short", label: "короткая", en: "short neat chunky sculpted haircut with a textured fringe",
            layers: {
              hairFront: '<path d="M54,150 C46,84 88,42 150,42 C212,42 254,84 246,150 L238,150 C236,128 230,112 220,102 C206,112 186,112 172,100 C160,112 136,114 124,100 C112,112 94,114 82,104 C72,114 66,130 64,150 Z" fill="{c}"/>' +
                '<path d="M96,60 C120,50 150,48 176,54" fill="none" stroke="{cl}" stroke-width="3" opacity=".6"/>',
            } },
          { id: "bob", label: "каре", en: "chin-length bob haircut with straight blunt bangs",
            layers: {
              hairBack: '<path d="M44,140 C42,74 90,34 150,34 C210,34 258,74 256,140 L258,240 L42,240 Z" fill="{cd}"/>',
              hairFront: '<path d="M52,222 L50,140 C48,76 92,40 150,40 C208,40 252,76 250,140 L248,222 C242,226 234,226 228,222 C230,180 228,140 224,118 C190,126 110,126 76,118 C72,140 70,180 72,222 C66,226 58,226 52,222 Z" fill="{c}"/>' +
                '<path d="M110,122 L112,92 M150,124 L150,90 M190,122 L188,92" fill="none" stroke="{cd}" stroke-width="2" opacity=".6"/>',
            } },
          { id: "long", label: "длинные прямые", en: "long straight hair falling over the shoulders, side part",
            layers: {
              hairBack: '<path d="M42,140 C40,72 90,32 150,32 C210,32 260,72 258,140 L262,300 C220,310 80,310 38,300 Z" fill="{cd}"/>',
              hairFront: '<path d="M50,290 L50,140 C48,76 92,40 150,40 C208,40 252,76 250,140 L252,290 C244,296 234,296 228,290 C226,220 226,150 220,124 C190,110 160,92 138,86 C124,106 100,120 80,126 C74,160 74,220 74,290 C66,296 56,296 50,290 Z" fill="{c}"/>' +
                '<path d="M62,180 L62,280 M238,180 L240,280 M138,88 C170,60 200,62 222,90" fill="none" stroke="{cd}" stroke-width="2" opacity=".6"/>',
            } },
          { id: "curly", label: "кудри", en: "big voluminous curly hair made of chunky round curls",
            layers: {
              hairBack: curls(150, 140, 94, 98, 0.68, 2.32, 15, 24, "{cd}"),
              hairFront: '<ellipse cx="150" cy="84" rx="84" ry="42" fill="{c}"/>' +
                curls(150, 132, 92, 82, 1.0, 2.0, 11, 21, "{c}") +
                curls(150, 120, 52, 30, 1.0, 2.0, 5, 18, "{c}"),
            } },
          { id: "ponytail", label: "хвост", en: "hair slicked back into a high ponytail with a hair tie",
            layers: {
              hairBack: '<path d="M196,56 C262,34 300,110 268,210 C262,234 248,250 236,252 C246,220 250,170 236,130 C228,104 214,84 196,76 Z" fill="{c}"/>' +
                '<path d="M226,70 C262,90 268,150 252,214" fill="none" stroke="{cd}" stroke-width="2" opacity=".6"/>',
              hairFront: '<path d="M56,146 C50,78 94,42 150,42 C206,42 250,78 244,146 C238,122 226,104 208,94 C180,86 150,84 126,90 C100,96 76,110 64,130 C60,136 58,140 56,146 Z" fill="{c}"/>' +
                '<ellipse cx="214" cy="60" rx="9" ry="13" fill="{cd}" transform="rotate(-30 214 60)"/>',
            } },
          { id: "bun", label: "пучок", en: "hair pulled up into a neat top bun",
            layers: {
              hairBack: '<circle cx="150" cy="34" r="31" fill="{c}"/>' +
                '<path d="M128,30 C134,14 166,14 172,30 M134,42 C142,30 160,30 166,42" fill="none" stroke="{cd}" stroke-width="2" opacity=".7"/>',
              hairFront: '<path d="M56,146 C50,78 94,42 150,42 C206,42 250,78 244,146 C236,118 220,100 196,92 C176,86 162,88 150,96 C138,88 124,86 104,92 C80,100 64,118 56,146 Z" fill="{c}"/>' +
                '<rect x="128" y="38" width="44" height="9" fill="{cd}"/>',
            } },
          { id: "bald", label: "лысый", en: "completely bald head", layers: {} },
        ],
      },

      /* ---------------- Верх ---------------- */
      {
        key: "top", tab: "Верх", title: "Верх", colorTitle: "Цвет верха",
        colors: CLOTH, defaultColor: "white", default: "tshirt",
        options: [
          { id: "tshirt", label: "футболка", en: "T-shirt",
            layers: { top: TORSO + SLEEVES_SHORT +
              '<path d="M138,234 C142,243 158,243 162,234" fill="none" stroke="{cd}" stroke-width="2"/>' } },
          { id: "hoodie", label: "худи", en: "hoodie",
            layers: { top: TORSO + SLEEVES_LONG +
              '<path d="M126,282 L174,282 L178,302 L122,302 Z" fill="{cd}" opacity=".35"/>' +
              '<path d="M126,234 C130,220 170,220 174,234 C166,246 134,246 126,234 Z" fill="{cd}"/>' +
              '<path d="M144,242 L143,264 M156,242 L157,264" fill="none" stroke="{cl}" stroke-width="2.5"/>' +
              '<path d="M100,284 L115,286 M200,284 L185,286" fill="none" stroke="{cd}" stroke-width="2"/>' } },
          { id: "shirt", label: "рубашка", en: "button-up collared shirt",
            layers: { top: TORSO + SLEEVES_LONG +
              '<path d="M150,246 L150,304" fill="none" stroke="{cd}" stroke-width="1.5"/>' +
              '<g stroke="none" fill="{cd}"><circle cx="154" cy="260" r="1.8"/><circle cx="154" cy="274" r="1.8"/><circle cx="154" cy="288" r="1.8"/></g>' +
              '<path d="M134,231 L150,246 L139,252 L130,236 Z" fill="{cl}"/><path d="M166,231 L150,246 L161,252 L170,236 Z" fill="{cl}"/>' } },
          { id: "dress", label: "платье", en: "knee-length dress", hides: ["bottom"],
            layers: { top: '<path d="M118,236 C128,231 172,231 182,236 L184,280 L116,280 Z" fill="{c}"/>' +
              '<path d="M116,276 L184,276 L198,336 C170,342 130,342 102,336 Z" fill="{c}"/>' + SLEEVES_SHORT +
              '<path d="M116,278 L184,278" fill="none" stroke="{cd}" stroke-width="4"/>' +
              '<path d="M132,290 L126,334 M150,290 L150,338 M168,290 L174,334" fill="none" stroke="{cd}" stroke-width="1.5" opacity=".6"/>' +
              '<path d="M136,234 C142,246 158,246 164,234" fill="none" stroke="{cd}" stroke-width="2"/>' } },
          { id: "puffer", label: "пуховик", en: "puffy quilted down jacket",
            layers: { top: '<path d="M119,236 C103,240 95,258 94,290 L117,293 C118,272 120,258 125,250 Z" fill="{c}"/>' +
              '<path d="M181,236 C197,240 205,258 206,290 L183,293 C182,272 180,258 175,250 Z" fill="{c}"/>' +
              '<path d="M114,234 C126,228 174,228 186,234 L192,312 L108,312 Z" fill="{c}"/>' +
              '<path d="M112,256 C130,262 170,262 188,256 M110,280 C130,286 170,286 190,280 M98,262 L118,264 M202,262 L182,264" fill="none" stroke="{cd}" stroke-width="2"/>' +
              '<path d="M128,224 L172,224 L170,242 L130,242 Z" fill="{c}"/>' +
              '<path d="M150,226 L150,312" fill="none" stroke="{cd}" stroke-width="2"/>' } },
          { id: "scrubs", label: "медицинская форма", en: "medical scrubs top with a V-neck and chest pocket",
            layers: { top: TORSO + SLEEVES_SHORT +
              '<path d="M137,233 L150,254 L163,233 Z" fill="{skin}"/>' +
              '<path d="M137,233 L150,254 L163,233" fill="none" stroke="{cd}" stroke-width="3"/>' +
              '<path d="M161,262 L177,262 L177,278 L161,278 Z" fill="none" stroke="{cd}" stroke-width="2"/>' } },
        ],
      },

      /* ---------------- Низ ---------------- */
      {
        key: "bottom", tab: "Низ", title: "Низ", colorTitle: "Цвет низа",
        colors: CLOTH, defaultColor: "denim", default: "jeans",
        options: [
          { id: "jeans", label: "джинсы", en: "jeans", plural: true,
            layers: { bottoms: PANTS +
              '<path d="M118,306 L182,306 M150,306 L150,318 M128,312 C132,318 138,318 142,312 M158,312 C162,318 168,318 172,312" fill="none" stroke="{cl}" stroke-width="1.5" opacity=".8"/>' } },
          { id: "trousers", label: "брюки", en: "straight trousers", plural: true,
            layers: { bottoms: PANTS +
              '<path d="M117,304 L183,304" fill="none" stroke="{cd}" stroke-width="3"/>' +
              '<path d="M135,316 L135,348 M165,316 L165,348" fill="none" stroke="{cd}" stroke-width="1.5"/>' } },
          { id: "skirt", label: "юбка", en: "A-line skirt",
            layers: { bottoms: '<path d="M117,298 L183,298 L192,330 L108,330 Z" fill="{c}"/>' +
              '<path d="M117,303 L183,303" fill="none" stroke="{cd}" stroke-width="3"/>' +
              '<path d="M132,306 L127,329 M150,306 L150,329 M168,306 L173,329" fill="none" stroke="{cd}" stroke-width="1.5" opacity=".7"/>' } },
          { id: "shorts", label: "шорты", en: "shorts", plural: true,
            layers: { bottoms: '<path d="M117,298 L183,298 L182,324 L153,324 L150,314 L147,324 L118,324 Z" fill="{c}"/>' +
              '<path d="M117,303 L183,303" fill="none" stroke="{cd}" stroke-width="3"/>' } },
        ],
      },

      /* ---------------- Обувь ---------------- */
      {
        key: "shoes", tab: "Обувь", title: "Обувь", colorTitle: "Цвет обуви",
        colors: CLOTH, defaultColor: "white", default: "sneakers",
        options: [
          { id: "sneakers", label: "кеды", en: "sneakers",
            layers: { shoes:
              '<path d="M122,344 L148,344 L149,360 L117,360 C116,352 118,347 122,344 Z" fill="{c}"/>' +
              '<path d="M152,344 L178,344 C182,347 184,352 183,360 L151,360 Z" fill="{c}"/>' +
              '<path d="M115,358 L150,358 L150,366 L115,366 Z M150,358 L185,358 L185,366 L150,366 Z" fill="#fbfaf7"/>' +
              '<path d="M130,348 L142,348 M130,352 L142,352 M158,348 L170,348 M158,352 L170,352" fill="none" stroke="{cd}" stroke-width="1.5"/>' } },
          { id: "boots", label: "ботинки", en: "chunky ankle boots",
            layers: { shoes:
              '<path d="M123,326 L148,326 L149,358 L116,358 C116,350 119,346 123,344 Z" fill="{c}"/>' +
              '<path d="M152,326 L177,326 L177,344 C181,346 184,350 184,358 L151,358 Z" fill="{c}"/>' +
              '<path d="M115,357 L150,357 L150,366 L115,366 Z M150,357 L185,357 L185,366 L150,366 Z" fill="{cd}"/>' +
              '<path d="M123,332 L148,332 M152,332 L177,332" fill="none" stroke="{cd}" stroke-width="1.5"/>' } },
          { id: "flats", label: "туфли", en: "classic shoes",
            layers: { shoes:
              '<path d="M124,348 L148,348 L149,363 C138,367 122,367 117,363 C117,355 120,350 124,348 Z" fill="{c}"/>' +
              '<path d="M152,348 L176,348 C180,350 183,355 183,363 C178,367 162,367 151,363 Z" fill="{c}"/>' +
              '<g stroke="none" fill="#fff" opacity=".55"><ellipse cx="128" cy="355" rx="5" ry="2"/><ellipse cx="172" cy="355" rx="5" ry="2"/></g>' } },
        ],
      },

      /* ---------------- Аксессуары (можно несколько) ---------------- */
      {
        key: "acc", tab: "Аксессуары", title: "Аксессуары", multi: true,
        hint: "Можно выбрать несколько",
        options: [
          { id: "glasses", label: "очки", en: "round glasses",
            layers: { accFront:
              '<circle cx="114" cy="158" r="24" fill="#fff" fill-opacity=".15" stroke="#1d1d1d" stroke-width="3.5"/>' +
              '<circle cx="186" cy="158" r="24" fill="#fff" fill-opacity=".15" stroke="#1d1d1d" stroke-width="3.5"/>' +
              '<path d="M138,155 Q150,147 162,155 M90,154 L62,148 M210,154 L238,148" fill="none" stroke="#1d1d1d" stroke-width="3.5"/>' } },
          { id: "cap", label: "кепка", en: "baseball cap",
            layers: { accFront:
              '<path d="M54,116 C54,58 96,32 150,32 C204,32 246,58 246,116 Z" fill="#c8372d"/>' +
              '<path d="M54,112 C90,104 210,104 246,112 C250,118 251,124 250,128 C200,120 100,120 50,128 C49,122 50,117 54,112 Z" fill="#9c2a22"/>' +
              '<path d="M150,34 L150,108 M104,44 C112,70 114,90 112,108 M196,44 C188,70 186,90 188,108" fill="none" stroke="#9c2a22" stroke-width="1.5"/>' +
              '<circle cx="150" cy="34" r="5" fill="#9c2a22"/>' } },
          { id: "stethoscope", label: "стетоскоп", en: "stethoscope around the neck",
            layers: { accMid:
              '<path d="M133,232 C124,262 136,286 150,288 C164,286 176,262 167,232" fill="none" stroke="#2f3a40" stroke-width="3.5"/>' +
              '<path d="M150,288 L150,294" fill="none" stroke="#2f3a40" stroke-width="3.5"/>' +
              '<circle cx="150" cy="299" r="6.5" fill="#c3c9cc"/>' } },
          { id: "bag", label: "сумка", en: "small crossbody bag",
            layers: { accMid:
              '<path d="M122,238 L186,290" fill="none" stroke="#5a3a22" stroke-width="4.5"/>' +
              '<path d="M176,284 L210,284 L212,314 L174,314 Z" fill="#8a5630"/>' +
              '<path d="M176,284 L210,284 L208,298 L178,298 Z" fill="#6f4426"/>' +
              '<circle cx="193" cy="298" r="2.5" fill="#e3c486"/>' } },
          { id: "keychain", label: "крепление-брелок (+500 ₽)", en: "a small metal keychain ring attached to the top of the head", price: 500, layers: {} },
          { id: "headphones", label: "наушники", en: "over-ear headphones",
            layers: { accFront:
              '<path d="M60,146 C52,62 100,28 150,28 C200,28 248,62 240,146" fill="none" stroke="#242424" stroke-width="8"/>' +
              '<rect x="44" y="126" width="24" height="48" rx="10" fill="#242424"/>' +
              '<rect x="232" y="126" width="24" height="48" rx="10" fill="#242424"/>' } },
        ],
      },

      /* ---------------- Питомец ---------------- */
      {
        key: "pet", tab: "Питомец", title: "Питомец рядом", colorTitle: "Окрас", colorWord: "окрас",
        colors: PET, defaultColor: "ginger", default: "none",
        options: [
          { id: "none", label: "нет", en: "", layers: {} },
          { id: "cat", label: "кот", en: "cat", shiftFigure: -28,
            layers: { pet: '<g transform="translate(248,368) scale(1.15)">' +
              '<path d="M14,-6 C34,-8 38,-28 28,-40" fill="none" stroke="{c}" stroke-width="7"/>' +
              '<ellipse cx="0" cy="-16" rx="18" ry="17" fill="{c}"/>' +
              '<path d="M-15,-52 L-13,-71 L-2,-60 Z M15,-52 L13,-71 L2,-60 Z" fill="{c}"/>' +
              '<circle cx="0" cy="-45" r="17" fill="{c}"/>' +
              '<g stroke="none"><ellipse cx="-6.5" cy="-46" rx="3.4" ry="4.2" fill="#141111"/><ellipse cx="6.5" cy="-46" rx="3.4" ry="4.2" fill="#141111"/>' +
              '<circle cx="-5.5" cy="-47.5" r="1.2" fill="#fff"/><circle cx="7.5" cy="-47.5" r="1.2" fill="#fff"/>' +
              '<path d="M-2,-39 L2,-39 L0,-37 Z" fill="#e07a86"/></g>' +
              '<ellipse cx="-7" cy="-2" rx="6" ry="4" fill="{cl}"/><ellipse cx="7" cy="-2" rx="6" ry="4" fill="{cl}"/></g>' } },
          { id: "dog", label: "собака", en: "dog", shiftFigure: -28,
            layers: { pet: '<g transform="translate(248,368) scale(1.15)">' +
              '<path d="M16,-10 C28,-14 30,-24 26,-30" fill="none" stroke="{c}" stroke-width="6"/>' +
              '<ellipse cx="0" cy="-16" rx="19" ry="18" fill="{c}"/>' +
              '<circle cx="0" cy="-46" r="18" fill="{c}"/>' +
              '<path d="M-13,-59 C-27,-57 -27,-38 -19,-33 C-15,-40 -12,-48 -11,-57 Z" fill="{cd}"/>' +
              '<path d="M13,-59 C27,-57 27,-38 19,-33 C15,-40 12,-48 11,-57 Z" fill="{cd}"/>' +
              '<ellipse cx="0" cy="-38" rx="9" ry="7" fill="{cl}"/>' +
              '<g stroke="none"><ellipse cx="0" cy="-41" rx="3.6" ry="2.6" fill="#141111"/>' +
              '<ellipse cx="-7" cy="-50" rx="3.2" ry="4" fill="#141111"/><ellipse cx="7" cy="-50" rx="3.2" ry="4" fill="#141111"/>' +
              '<circle cx="-6" cy="-51.5" r="1.1" fill="#fff"/><circle cx="8" cy="-51.5" r="1.1" fill="#fff"/></g>' +
              '<ellipse cx="-7" cy="-2" rx="6" ry="4" fill="{cl}"/><ellipse cx="7" cy="-2" rx="6" ry="4" fill="{cl}"/></g>' } },
        ],
      },

      /* ---------------- Подставка ---------------- */
      { key: "text", tab: "Подставка", title: "Надпись на подставке", text: true, maxLength: 24,
        placeholder: "Например: Лучшему врачу" },
    ],
  };
})();
