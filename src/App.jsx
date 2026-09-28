import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ════════════════════════════════════════════════════════════════
   РУССКИЙ — Elementary tutor. Baza tili: o'zbek.
   Maqsad: kundalik suhbat + kitob/maqola o'qish.
   ════════════════════════════════════════════════════════════════ */

const RU = "ru-RU";

/* ── TEMA TOKENLARI ───────────────────────────────────────────────
   Tailwind `dark:` variantlari artifactda ishlamaydi (kompilyator yo'q).
   Shuning uchun bitta token obyekti — hamma rang shu yerdan chiqadi.
   Kun: eski gazeta qog'ozi. Tun: xuddi shu plakat qora nyusprintda.
   ─────────────────────────────────────────────────────────────── */
const THEME = {
  light: {
    bg: "#F2EFE9", ink: "#16110F", red: "#C1272D",
    dim: "rgba(22,17,15,.55)", faint: "rgba(22,17,15,.35)",
    line: "rgba(22,17,15,.18)", hair: "rgba(22,17,15,.10)",
    inv: "#F2EFE9", tint: "rgba(193,39,45,.09)", soft: "rgba(22,17,15,.045)",
    ok: "#2E7D5B",
  },
  dark: {
    bg: "#14100E", ink: "#EDE8DF", red: "#E04B4B",
    dim: "rgba(237,232,223,.55)", faint: "rgba(237,232,223,.35)",
    line: "rgba(237,232,223,.20)", hair: "rgba(237,232,223,.11)",
    inv: "#14100E", tint: "rgba(224,75,75,.13)", soft: "rgba(237,232,223,.055)",
    ok: "#4FBF8B",
  },
};
const Ctx = React.createContext(THEME.light);
const useT = () => React.useContext(Ctx);

/* ── OVOZ MOTORI ──────────────────────────────────────────────────
   ILDIZ SABAB (eski bug): faqat utterance.lang = "ru-RU" qo'yilgandi.
   Spetsifikatsiya bo'yicha .voice berilmasa, brauzer "eng mos default"ni
   O'ZI tanlaydi — amalda ingliz motori kirillni fonetik o'qiydi.
   Talaffuz shuning uchun xunuk chiqqan.
   YECHIM: getVoices() dan HAQIQIY rus ovoz obyektini topib .voice ga ber.
   + getVoices() birinchi chaqiruvda BO'SH qaytadi → voiceschanged kutiladi.
   + Android "ru_RU" (pastki chiziq) qaytaradi → normalizatsiya kerak.
   ─────────────────────────────────────────────────────────────── */
const norm = (s) => (s || "").replace("_", "-").toLowerCase();

/* localService=true  → ovoz QURILMADA. Internetsiz ishlaydi.
   localService=false → Google/Microsoft BULUT ovozi. Tabiiyroq,
   lekin internetsiz UMUMAN ishlamaydi (fallback yo'q).
   Shuning uchun `offline` bayrog'i ballni teskari aylantiradi. */
function rank(v, offline) {
  const n = (v.name || "").toLowerCase();
  let s = 0;
  if (offline) {
    if (v.localService) s += 100;      // offline: lokal ovoz SHART
    else s -= 500;                      // bulut ovozi offline'da O'LIK
  } else {
    if (!v.localService) s += 45;      // online: bulut = tabiiyroq
  }
  if (n.includes("natural") || n.includes("neural")) s += 40;
  if (n.includes("google")) s += 30;
  if (n.includes("microsoft")) s += 28;
  if (/svetlana|milena|dariya|yuri|pavel|dmitr|irina|katya/.test(n)) s += 12;
  if (n.includes("compact")) s -= 25;
  if (n.includes("espeak")) s -= 60;   // robot — eng yomoni
  return s;
}

let ACTIVE = null;                                     // global — prop drilling yo'q

function speak(text, rate = 0.9) {
  const S = window.speechSynthesis;
  if (!S || !text) return;
  S.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = RU;
  if (ACTIVE) u.voice = ACTIVE;                        // ◄── ASOSIY TUZATISH
  u.rate = rate;
  S.speak(u);
}

/* Ovozni sinash uchun jumla. Ichida ы, щ, akannye — hammasi bir joyda.
   Ovoz noto'g'ri bo'lsa, buni eshitib DARHOL bilasan. */
const TEST_LINE = "Здравствуйте! Я говорю по-русски. Хорошо, что вы слышите.";

function useVoices(offline) {
  const [all, setAll] = useState([]);
  const [pick, setPick] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const S = window.speechSynthesis;
    if (!S) { setReady(true); return; }
    const scan = () => {
      const ru = S.getVoices().filter((v) => norm(v.lang).startsWith("ru"));
      if (!ru.length) return false;
      setAll(ru); setReady(true);
      return true;
    };
    if (!scan()) {
      S.onvoiceschanged = scan;
      const t = setTimeout(() => { scan(); setReady(true); }, 1600);  // zaxira
      return () => { clearTimeout(t); S.onvoiceschanged = null; };
    }
  }, []);

  // Offline rejimda faqat qurilmadagi ovozlar
  const list = useMemo(
    () => all.filter((v) => (offline ? v.localService : true)),
    [all, offline]
  );

  // Tanlangan ovoz ro'yxatdan chiqib qolsa (offline yoqilganda) — qayta tanlaymiz
  useEffect(() => {
    if (!list.length) { setPick(null); return; }
    setPick((p) => {
      if (p && list.some((v) => v.name === p.name)) return p;
      return list.slice().sort((a, b) => rank(b, offline) - rank(a, offline))[0];
    });
  }, [list, offline]);

  useEffect(() => { ACTIVE = pick; }, [pick]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return { all, list, pick, setPick, ready, has: !!pick };
}

/* ── MIKROFON ─────────────────────────────────────────────────────
   HALOL HAQIQAT: artifact cross-origin iframe ichida ishlaydi.
   Chrome 64 dan beri bunday iframe'da mikrofon BLOKLANADI, agar
   ota-sahifa iframe'ga allow="microphone" bermasa. Biz ota-sahifani
   boshqarolmaymiz. Ya'ni brauzerdan qancha ruxsat bersang ham
   SpeechRecognition "not-allowed" beraveradi. Bu brauzer ruxsati emas —
   sahifa siyosati (Permissions-Policy).
   Shuning uchun: mount'da HAQIQIY probe qilamiz va yolg'on tugma
   ko'rsatmaymiz. Fayl lokal ishlatilsa (iframe'siz) — to'liq ishlaydi.
   ─────────────────────────────────────────────────────────────── */
const SR = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function useMic() {
  const [st, setSt] = useState("checking");   // checking|ok|no-api|blocked|denied
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!SR) return void (!dead && setSt("no-api"));
      if (!navigator.mediaDevices?.getUserMedia) return void (!dead && setSt("blocked"));
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());        // darhol yopamiz
        if (!dead) setSt("ok");
      } catch {
        if (!dead) setSt(window.self !== window.top ? "blocked" : "denied");
      }
    })();
    return () => { dead = true; };
  }, []);
  return st;
}

const MIC_MSG = {
  "no-api": "Bu brauzer nutqni tanimaydi. Chrome yoki Edge ishlat.",
  blocked:
    "Mikrofon bu oynada ishlamaydi. Artifact xavfsizlik ramkasi (iframe) ichida turadi, brauzer esa bunday ramkaga mikrofon bermaydi — bu brauzer ruxsati emas, sahifa siyosati. Sen tarafingdan tuzatib bo'lmaydi. Faylni yuklab olib lokal ishga tushirsang, mikrofon to'liq ishlaydi. Hozircha yozib yubor — qolgan hammasi ishlaydi.",
  denied:
    "Mikrofonga ruxsat berilmadi. Manzil qatoridagi qulf belgisini bos → Mikrofon → Ruxsat ber → sahifani yangila.",
};

/* ── ALIFBO ─────────────────────────────────────────────────────── */
const ABC = [
  { l:"Аа", n:"а", tr:"a", say:"мама", sayTr:"máma", uz:"ona" },
  { l:"Бб", n:"бэ", tr:"b", say:"брат", sayTr:"brat", uz:"aka / uka" },
  { l:"Вв", n:"вэ", tr:"v", say:"вода", sayTr:"vadá", uz:"suv", note:"So'z oxirida 'f' bo'lib eshitiladi: Иванов → Ivanóf" },
  { l:"Гг", n:"гэ", tr:"g", say:"город", sayTr:"górad", uz:"shahar" },
  { l:"Дд", n:"дэ", tr:"d", say:"дом", sayTr:"dom", uz:"uy" },
  { l:"Ее", n:"е", tr:"ye", say:"если", sayTr:"yésli", uz:"agar", note:"So'z boshida — 'ye'. Urg'usiz bo'lsa 'i'ga yaqinlashadi." },
  { l:"Ёё", n:"ё", tr:"yo", say:"ёлка", sayTr:"yólka", uz:"archa", hard:1, note:"DOIM urg'uli. Kitoblarda ko'pincha oddiy 'е' deb chop etiladi — o'zing bilib o'qishing kerak." },
  { l:"Жж", n:"жэ", tr:"j", say:"жена", sayTr:"jyná", uz:"xotin", note:"Doim QATTIQ. O'zbekcha 'j' dan yo'g'onroq." },
  { l:"Зз", n:"зэ", tr:"z", say:"зима", sayTr:"zimá", uz:"qish" },
  { l:"Ии", n:"и", tr:"i", say:"имя", sayTr:"ímya", uz:"ism" },
  { l:"Йй", n:"и краткое", tr:"y", say:"мой", sayTr:"moy", uz:"mening" },
  { l:"Кк", n:"ка", tr:"k", say:"книга", sayTr:"kníga", uz:"kitob" },
  { l:"Лл", n:"эль", tr:"l", say:"лето", sayTr:"léta", uz:"yoz" },
  { l:"Мм", n:"эм", tr:"m", say:"молоко", sayTr:"malakó", uz:"sut" },
  { l:"Нн", n:"эн", tr:"n", say:"ночь", sayTr:"noch", uz:"tun" },
  { l:"Оо", n:"о", tr:"o / a", say:"окно", sayTr:"aknó", uz:"deraza", hard:1, note:"ENG MUHIM QOIDA. Urg'usiz 'о' → 'a' o'qiladi. окно = 'aknó', 'oknó' EMAS." },
  { l:"Пп", n:"пэ", tr:"p", say:"папа", sayTr:"pápa", uz:"ota" },
  { l:"Рр", n:"эр", tr:"r", say:"рука", sayTr:"ruká", uz:"qo'l", note:"Titroq 'r' — o'zbekchadan kuchliroq. Tilni tanglayga urib chiqar." },
  { l:"Сс", n:"эс", tr:"s", say:"стол", sayTr:"stol", uz:"stol" },
  { l:"Тт", n:"тэ", tr:"t", say:"тут", sayTr:"tut", uz:"shu yerda" },
  { l:"Уу", n:"у", tr:"u", say:"утро", sayTr:"útra", uz:"tong" },
  { l:"Фф", n:"эф", tr:"f", say:"фильм", sayTr:"film", uz:"kino" },
  { l:"Хх", n:"ха", tr:"x", say:"хлеб", sayTr:"xlep", uz:"non", note:"O'zbekcha 'x' bilan bir xil. Oxirgi 'б' → 'p' bo'lganiga e'tibor ber." },
  { l:"Цц", n:"цэ", tr:"ts", say:"центр", sayTr:"tsentr", uz:"markaz", hard:1, note:"O'zbek tilida YO'Q. 't' va 's' ni bitta tovushda qo'shib ayt." },
  { l:"Чч", n:"че", tr:"ch", say:"чай", sayTr:"chay", uz:"choy", note:"Doim YUMSHOQ — o'zbekcha 'ch' dan yumshoqroq." },
  { l:"Шш", n:"ша", tr:"sh", say:"школа", sayTr:"shkóla", uz:"maktab", note:"Doim QATTIQ." },
  { l:"Щщ", n:"ща", tr:"shch", say:"борщ", sayTr:"borshch", uz:"borsh (sho'rva)", hard:1, note:"Yumshoq, cho'ziq 'sh'. Tilni tanglayga yaqinlashtirib cho'z." },
  { l:"Ъъ", n:"твёрдый знак", tr:"—", say:"объект", sayTr:"ab-yékt", uz:"obyekt", hard:1, note:"Tovushi YO'Q. Undosh bilan unlini ajratadi. Yolg'iz o'qilmaydi." },
  { l:"Ыы", n:"ы", tr:"ı", say:"мыло", sayTr:"mýla", uz:"sovun", hard:1, note:"O'ZBEK TILIDA YO'Q — eng qiyin tovush. 'i' deyishga tayyorlan, lekin tilni orqaga tort. Turkcha 'ı' ga o'xshaydi." },
  { l:"Ьь", n:"мягкий знак", tr:"'", say:"мать", sayTr:"mat'", uz:"ona", hard:1, note:"Tovushi YO'Q. Oldingi undoshni YUMSHATADI. 'мат' va 'мать' — boshqa so'z. Yolg'iz o'qilmaydi." },
  { l:"Ээ", n:"э", tr:"e", say:"это", sayTr:"éta", uz:"bu" },
  { l:"Юю", n:"ю", tr:"yu", say:"юг", sayTr:"yuk", uz:"janub" },
  { l:"Яя", n:"я", tr:"ya", say:"яблоко", sayTr:"yábloka", uz:"olma" },
];
const HARD_N = ABC.filter((a) => a.hard).length;

/* ── DECKLAR ────────────────────────────────────────────────────── */
const DECKS = {
  "Salomlashuv": [
    { ru: "Здравствуйте", tr: "zdrástvuyte", uz: "Assalomu alaykum (rasmiy)" },
    { ru: "Привет", tr: "privét", uz: "Salom (do'stona)" },
    { ru: "Как дела?", tr: "kak dilá?", uz: "Ishlar qalay?" },
    { ru: "Хорошо, спасибо", tr: "xarashó, spasíba", uz: "Yaxshi, rahmat" },
    { ru: "Меня зовут…", tr: "minyá zavút…", uz: "Mening ismim…" },
    { ru: "Очень приятно", tr: "óchin priyátna", uz: "Juda yoqimli (tanishganda)" },
    { ru: "До свидания", tr: "da svidániya", uz: "Xayr" },
    { ru: "Пока", tr: "paká", uz: "Ko'rishguncha (do'stona)" },
    { ru: "Извините", tr: "izviníte", uz: "Kechirasiz" },
    { ru: "Пожалуйста", tr: "pajálusta", uz: "Marhamat / iltimos" },
  ],
  "Kundalik gap": [
    { ru: "Я не понимаю", tr: "ya ni panimáyu", uz: "Men tushunmayapman" },
    { ru: "Говорите медленнее", tr: "gavaríte médlenneye", uz: "Sekinroq gapiring" },
    { ru: "Сколько это стоит?", tr: "skólka éta stóit?", uz: "Bu qancha turadi?" },
    { ru: "Где находится…?", tr: "gde naxóditsa…?", uz: "… qayerda joylashgan?" },
    { ru: "Мне нужно…", tr: "mne núzhna…", uz: "Menga … kerak" },
    { ru: "Я хочу…", tr: "ya xachú…", uz: "Men … xohlayman" },
    { ru: "Можно?", tr: "mózhna?", uz: "Mumkinmi?" },
    { ru: "Конечно", tr: "kanéshna", uz: "Albatta", note: "чн → 'shn' o'qiladi. Yozilishiga aldanma." },
    { ru: "Ничего страшного", tr: "nichivó stráshnava", uz: "Hech qisi yo'q", note: "-его → 'ivo' o'qiladi." },
    { ru: "Что это значит?", tr: "shto éta znáchit?", uz: "Bu nima degani?", note: "что → 'shto'." },
  ],
  "O'qish: bog'lovchi": [
    { ru: "потому что", tr: "patamú shta", uz: "chunki" },
    { ru: "поэтому", tr: "paétamu", uz: "shuning uchun" },
    { ru: "однако", tr: "adnáka", uz: "biroq" },
    { ru: "например", tr: "naprimér", uz: "masalan" },
    { ru: "кроме того", tr: "króme tavó", uz: "bundan tashqari" },
    { ru: "в то время как", tr: "f to vrémya kak", uz: "…bo'lgan bir paytda" },
    { ru: "таким образом", tr: "takím óbrazam", uz: "shu tariqa" },
    { ru: "несмотря на", tr: "nismatryá na", uz: "…ga qaramay" },
    { ru: "то есть", tr: "to yest", uz: "ya'ni" },
    { ru: "во-первых", tr: "va-pérvıx", uz: "birinchidan" },
  ],
  "O'qish: kitob": [
    { ru: "глава", tr: "glavá", uz: "bob" },
    { ru: "страница", tr: "straníitsa", uz: "sahifa" },
    { ru: "автор", tr: "áftar", uz: "muallif" },
    { ru: "герой", tr: "giróy", uz: "qahramon" },
    { ru: "смысл", tr: "smısl", uz: "ma'no" },
    { ru: "предложение", tr: "pridlajéniye", uz: "gap / jumla" },
    { ru: "значение", tr: "znachéniye", uz: "ahamiyat" },
    { ru: "вывод", tr: "vívad", uz: "xulosa" },
    { ru: "исследование", tr: "islédavaniye", uz: "tadqiqot" },
    { ru: "мнение", tr: "mnéniye", uz: "fikr" },
  ],
};

const ROLES = [
  { id: "cafe", label: "Kafede", p: "Sen kafe ofitsiantisan. Foydalanuvchi — mijoz." },
  { id: "meet", label: "Tanishuv", p: "Sen universitetda yangi tanishgan rus talabasan." },
  { id: "shop", label: "Do'konda", p: "Sen do'kon sotuvchisisan." },
  { id: "road", label: "Yo'l so'rash", p: "Sen ko'chadagi o'tkinchisan, foydalanuvchi yo'l so'rayapti." },
  { id: "book", label: "Kitob haqida", p: "Sen kitobxonlar klubidasan. O'qilgan kitob haqida sodda tilda gaplashyapsan." },
];

const SYSTEM = `Sen rus tili repetitorisan. Talaba — o'zbek, ELEMENTARY (A1–A2).
Maqsadi: (1) kundalik suhbat, (2) rus tilida kitob va maqola o'qiy olish.

HAR BIR JAVOBING ANIQ SHU FORMATDA. Prefikslarni HECH QACHON tashlab ketma.

RU: <rus tilidagi javob, 1–3 sodda gap>
TR: <lotin transliteratsiya. Urg'uli unliga urg'u belgisi: privét, malakó>
UZ: <o'zbekcha tarjima>
FIX: <talaba xato qilgan bo'lsa — xatoni ayt va tuzat, o'zbekcha, 1 qator. Xato yo'q: NONE>
NOTE: <bitta grammatik yoki leksik izoh, o'zbekcha, 1 qator. Kerak emas: NONE>

QOIDALAR:
- Sodda leksika. Elementary darajadan oshirma.
- Har javob oxirida savol ber — suhbat to'xtamasin.
- Kelishikni (падеж) o'zbek kelishiklariga taqqosla:
  винительный ≈ tushum (-ni) · дательный ≈ jo'nalish (-ga)
  предложный ≈ o'rin-payt (-da) · родительный ≈ qaratqich (-ning)
  творительный ≈ "bilan" ma'nosi
- Rus tilida ROD (jins) bor — o'zbekchada YO'Q. Har yangi otni jinsi bilan ber: (m)/(f)/(n).
- Lektsiya berma. Suhbat orqali o'rgat.`;

/* ── API ────────────────────────────────────────────────────────── */
async function ask(messages, system) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
  });
  if (!r.ok) throw new Error("api " + r.status);
  const d = await r.json();
  return d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parse(raw) {
  const g = (k) => {
    const m = raw.match(new RegExp("^\\s*" + k + "\\s*:\\s*(.+)$", "mi"));
    const v = m ? m[1].trim() : "";
    return v && v.toUpperCase() !== "NONE" ? v : "";
  };
  const ru = g("RU");
  // Format buzilsa BO'SH PUZIR ko'rsatmaymiz — xom matnni beramiz.
  if (!ru) return { ru: "", tr: "", uz: raw.trim(), fix: "", note: "", raw };
  return { ru, tr: g("TR"), uz: g("UZ"), fix: g("FIX"), note: g("NOTE"), raw };
}

/* ── ATOMLAR ────────────────────────────────────────────────────── */
function Snd({ text, slow, big }) {
  const t = useT();
  const [h, setH] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(text, slow ? 0.55 : 0.9); }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={slow ? "Sekin" : "Eshitish"}
      style={{
        width: big ? 38 : 26, height: big ? 38 : 26,
        border: `1px solid ${h ? t.red : t.line}`,
        background: h ? t.red : "transparent",
        color: h ? t.inv : t.dim,
        fontFamily: "ui-monospace,monospace", fontSize: big ? 12 : 10,
        display: "grid", placeItems: "center", flexShrink: 0,
        cursor: "pointer", transition: "all .12s",
      }}
    >
      {slow ? "½×" : "▶"}
    </button>
  );
}

function K({ children }) {
  const t = useT();
  return (
    <kbd style={{
      padding: "1px 5px", border: `1px solid ${t.line}`, color: t.faint,
      fontFamily: "ui-monospace,monospace", fontSize: 10, lineHeight: 1.4,
    }}>{children}</kbd>
  );
}

function Tag({ on, onClick, children }) {
  const t = useT();
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: "6px 12px", fontSize: 11, letterSpacing: ".08em",
        textTransform: "uppercase", cursor: "pointer", transition: "all .12s",
        border: `1px solid ${on ? t.red : h ? t.red : t.line}`,
        background: on ? t.red : "transparent",
        color: on ? t.inv : h ? t.red : t.dim,
      }}
    >
      {children}
    </button>
  );
}

function Note({ label, children, accent }) {
  const t = useT();
  return (
    <div style={{
      borderLeft: `2px solid ${accent ? t.red : t.line}`,
      background: accent ? t.tint : t.soft,
      padding: "8px 12px",
    }}>
      <p style={{
        fontFamily: "ui-monospace,monospace", fontSize: 9, letterSpacing: ".18em",
        textTransform: "uppercase", color: accent ? t.red : t.faint, margin: "0 0 4px",
      }}>{label}</p>
      <p style={{ fontSize: 13, color: t.ink, margin: 0, lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SUHBAT
   ════════════════════════════════════════════════════════════════ */
function Chat({ onScore, mic }) {
  const t = useT();
  const seed = useMemo(() => ({
    ru: "Привет! Давай поговорим по-русски.",
    tr: "privét! daváy pagavarím pa-rússki.",
    uz: "Salom! Kel, rus tilida gaplashamiz.",
    note: "«давай» — taklif qilishning eng keng tarqalgan usuli.",
    raw: "RU: Привет! Давай поговорим по-русски.\nTR: privét! daváy pagavarím pa-rússki.\nUZ: Salom! Kel, rus tilida gaplashamiz.\nFIX: NONE\nNOTE: «давай» — taklif qilishning eng keng tarqalgan usuli.",
  }), []);

  const [log, setLog] = useState([{ me: 0, d: seed }]);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState(null);
  const [rec, setRec] = useState(false);
  const [err, setErr] = useState("");
  const rRef = useRef(null), endRef = useRef(null), inRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log, busy]);

  // roleArg — stale-closure bug'ini oldini oladi (eski kodda shu bor edi)
  const send = async (text, roleArg) => {
    const s = text.trim();
    if (!s || busy) return;
    const R = roleArg !== undefined ? roleArg : role;
    const next = [...log, { me: 1, text: s }];
    setLog(next); setTxt(""); setBusy(true);
    try {
      const msgs = next.map((m) => m.me
        ? { role: "user", content: m.text }
        : { role: "assistant", content: m.d.raw || m.d.ru || m.d.uz });
      const d = parse(await ask(msgs, SYSTEM + (R ? "\n\nROL: " + R.p : "")));
      setLog((l) => [...l, { me: 0, d }]);
      if (d.ru) speak(d.ru);
      onScore(2);
    } catch {
      setLog((l) => [...l, { me: 0, d: { ru: "", tr: "", uz: "Aloqa uzildi. Qayta yubor.", bad: 1 } }]);
    }
    setBusy(false);
    inRef.current?.focus();
  };

  const toggleRole = (r) => {
    if (role?.id === r.id) { setRole(null); setLog([{ me: 0, d: seed }]); return; }
    setRole(r); setLog([]); send("Начнём разговор.", r);
  };

  const onMic = () => {
    if (mic !== "ok") { setErr(MIC_MSG[mic] || ""); return; }
    if (rec) { rRef.current?.stop(); setRec(false); return; }
    const r = new SR();
    r.lang = RU; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const v = e.results[0][0].transcript; setTxt(v); send(v); };
    r.onerror = (e) => { setErr(e.error === "not-allowed" ? MIC_MSG.blocked : "Mikrofon xatosi: " + e.error); setRec(false); };
    r.onend = () => setRec(false);
    rRef.current = r; setErr("");
    try { r.start(); setRec(true); } catch { setRec(false); }
  };

  const live = mic === "ok";
  const field = {
    flex: 1, padding: "11px 14px", background: "transparent",
    border: `1px solid ${t.line}`, color: t.ink, fontSize: 14, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 540 }}>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${t.hair}` }}>
        {ROLES.map((r) => (
          <Tag key={r.id} on={role?.id === r.id} onClick={() => toggleRole(r)}>{r.label}</Tag>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {log.map((m, i) => m.me ? (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <p style={{ background: t.ink, color: t.inv, padding: "8px 14px", maxWidth: "78%", fontSize: 14, margin: 0 }}>
              {m.text}
            </p>
          </div>
        ) : (
          <div key={i} style={{ marginBottom: 16, maxWidth: "94%" }}>
            <div style={{ borderLeft: `2px solid ${t.red}`, paddingLeft: 14 }}>
              {m.d.ru && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <p style={{ flex: 1, margin: 0, fontFamily: "Georgia,serif", fontSize: 21, lineHeight: 1.35, color: t.ink }}>
                    {m.d.ru}
                  </p>
                  <Snd text={m.d.ru} />
                  <Snd text={m.d.ru} slow />
                </div>
              )}
              {m.d.tr && (
                <p style={{ margin: "6px 0 0", fontFamily: "ui-monospace,monospace", fontSize: 12.5, color: t.red }}>
                  {m.d.tr}
                </p>
              )}
              {m.d.uz && (
                <p style={{ margin: "6px 0 0", fontSize: 13.5, color: m.d.bad ? t.red : t.dim }}>
                  {m.d.uz}
                </p>
              )}
            </div>
            {m.d.fix && <div style={{ marginTop: 8, marginLeft: 14 }}><Note label="Xato" accent>{m.d.fix}</Note></div>}
            {m.d.note && <div style={{ marginTop: 4, marginLeft: 14 }}><Note label="Izoh">{m.d.note}</Note></div>}
          </div>
        ))}
        {busy && (
          <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: t.red, paddingLeft: 14, margin: 0 }}>
            говорит…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <p style={{ marginTop: 12, fontSize: 12, color: t.red, borderLeft: `2px solid ${t.red}`, paddingLeft: 12, lineHeight: 1.6 }}>
          {err}
        </p>
      )}

      <div style={{ display: "flex", gap: 1, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.hair}` }}>
        <button
          onClick={onMic}
          disabled={!live}
          title={live ? "Gapirish" : MIC_MSG[mic]}
          style={{
            width: 46, flexShrink: 0, fontFamily: "ui-monospace,monospace", fontSize: 12,
            border: `1px solid ${rec ? t.red : t.line}`,
            background: rec ? t.red : "transparent",
            color: !live ? t.faint : rec ? t.inv : t.dim,
            textDecoration: !live ? "line-through" : "none",
            cursor: live ? "pointer" : "not-allowed",
            opacity: live ? 1 : 0.5, transition: "all .12s",
          }}
        >
          МИК
        </button>
        <input
          ref={inRef} value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(txt)}
          placeholder="Rus yoki o'zbek tilida yoz…"
          style={field}
          onFocus={(e) => (e.target.style.borderColor = t.red)}
          onBlur={(e) => (e.target.style.borderColor = t.line)}
        />
        <button
          onClick={() => send(txt)}
          disabled={busy}
          style={{
            padding: "0 20px", background: t.red, color: t.inv, border: "none",
            fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
            cursor: "pointer", opacity: busy ? 0.3 : 1,
          }}
        >
          Yubor
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ALIFBO
   ════════════════════════════════════════════════════════════════ */
function Abc() {
  const t = useT();
  const [only, setOnly] = useState(false);
  const list = useMemo(() => (only ? ABC.filter((a) => a.hard) : ABC), [only]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [only]);
  const s = list[Math.min(i, list.length - 1)];

  const key = useCallback((e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight") { e.preventDefault(); setI((p) => (p + 1) % list.length); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setI((p) => (p - 1 + list.length) % list.length); }
    // MUHIM: harf NOMINI o'qitmaymiz. TTS bitta harfni ("о", "а") SO'Z deb
    // talqin qiladi va butunlay boshqa narsa o'qiydi — alifbo shuning uchun
    // "pand berardi". Har doim to'liq SO'ZNI o'qitamiz.
    else if (e.key === " ") { e.preventDefault(); speak(list[i]?.say, 0.8); }
    else if (k === "s") { e.preventDefault(); speak(list[i]?.say, 0.55); }
  }, [list, i]);

  useEffect(() => {
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [key]);

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: t.faint, margin: 0 }}>
          <K>←</K> <K>→</K> harf · <K>Space</K> so'zni eshit · <K>S</K> sekin
        </p>
        <Tag on={only} onClick={() => setOnly(!only)}>Faqat qiyinlari ({HARD_N})</Tag>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(46px,1fr))",
        gap: 1, background: t.hair, border: `1px solid ${t.hair}`,
      }}>
        {list.map((a, k) => {
          const on = k === i;
          return (
            <button
              key={a.l}
              onClick={() => { setI(k); speak(a.say, 0.8); }}
              style={{
                aspectRatio: "1", display: "grid", placeItems: "center", cursor: "pointer",
                border: "none", transition: "all .1s",
                background: on ? t.red : a.hard ? t.tint : t.bg,
                color: on ? t.inv : t.ink,
                fontFamily: "Georgia,serif", fontSize: 17,
              }}
            >
              {a.l}
            </button>
          );
        })}
      </div>

      {s && (
        <div style={{ marginTop: 18, border: `1px solid ${t.line}`, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontFamily: "Georgia,serif", fontSize: 44, lineHeight: 1, color: t.ink }}>{s.l}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontFamily: "ui-monospace,monospace", fontSize: 14, color: t.red }}>[{s.tr}]</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.faint }}>nomi: {s.n}</p>
            </div>
            <Snd text={s.say} big />
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 16,
            paddingTop: 16, borderTop: `1px solid ${t.hair}`, flexWrap: "wrap",
          }}>
            <span style={{ fontFamily: "Georgia,serif", fontSize: 22, color: t.ink }}>{s.say}</span>
            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: t.red }}>{s.sayTr}</span>
            <span style={{ fontSize: 13, color: t.dim }}>— {s.uz}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 1 }}>
              <Snd text={s.say} /><Snd text={s.say} slow />
            </div>
          </div>

          <p style={{ margin: "10px 0 0", fontSize: 10.5, color: t.faint }}>
            Tovushni so'z ichida eshit — TTS motori bitta harfni ishonchli o'qiy olmaydi.
          </p>

          {s.note && <div style={{ marginTop: 14 }}><Note label="Diqqat" accent>{s.note}</Note></div>}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Note label="O'zbek uchun asosiy tuzoq">
          Urg'usiz <b style={{ fontFamily: "Georgia,serif" }}>о</b> harfi <b>«a»</b> deb o'qiladi.{" "}
          <span style={{ fontFamily: "Georgia,serif" }}>молоко</span> yozilsa ham{" "}
          <span style={{ fontFamily: "ui-monospace,monospace", color: t.red }}>malakó</span> deb
          o'qiladi. Yozilishi va o'qilishi bir xil emas — o'zbek tilidan eng katta farq shu.
        </Note>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SO'ZLAR
   ════════════════════════════════════════════════════════════════ */
function Vocab({ onScore }) {
  const t = useT();
  const [deck, setDeck] = useState("Salomlashuv");
  const [cards, setCards] = useState(DECKS["Salomlashuv"]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState({});
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = cards[i];

  const go = useCallback((d) => {
    setFlip(false);
    setI((p) => (p + d + cards.length) % cards.length);
  }, [cards.length]);

  const mark = useCallback(() => {
    if (!c) return;
    setKnown((k) => (k[c.ru] ? k : (onScore(1), { ...k, [c.ru]: 1 })));
  }, [c, onScore]);

  const key = useCallback((e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === " ") { e.preventDefault(); setFlip((f) => !f); }
    else if (e.key === "Enter") { e.preventDefault(); mark(); }
    else if (k === "a") { e.preventDefault(); c && speak(c.ru); }
    else if (k === "s") { e.preventDefault(); c && speak(c.ru, 0.55); }
  }, [go, mark, c]);

  useEffect(() => {
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [key]);

  const load = (n) => { setDeck(n); setCards(DECKS[n]); setI(0); setFlip(false); setErr(""); };

  const gen = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const raw = await ask([{
        role: "user",
        content: `"${topic}" mavzusida 10 ta rus tili flashcard yarat. Elementary (A1–A2).
Faqat JSON massiv qaytar. Markdown backtick ISHLATMA. Boshqa matn qo'shma.
Format: [{"ru":"rus so'z yoki qisqa gap","tr":"lotin transliteratsiya, urg'uli unliga urg'u belgisi","uz":"o'zbekcha tarjima","note":"agar talaffuz tuzog'i bo'lsa — 1 qator, bo'lmasa tashla"}]`,
      }], "");
      const arr = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(arr) || !arr.length || !arr[0]?.ru) throw new Error("shape");
      setCards(arr); setDeck(topic); setI(0); setFlip(false); setKnown({}); setTopic("");
    } catch {
      setErr("Deck yasalmadi. Mavzuni aniqroq yozib, qayta uri.");
    }
    setBusy(false);
  };

  const learned = Object.keys(known).length;

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.keys(DECKS).map((n) => (
          <Tag key={n} on={deck === n} onClick={() => load(n)}>{n}</Tag>
        ))}
      </div>

      <div style={{ display: "flex", gap: 1, marginBottom: 18 }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && gen()}
          placeholder="O'z mavzung — shifokorda, iqtisodiyot, Dostoyevskiy…"
          style={{
            flex: 1, padding: "10px 14px", background: "transparent",
            border: `1px solid ${t.line}`, color: t.ink, fontSize: 13, outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = t.red)}
          onBlur={(e) => (e.target.style.borderColor = t.line)}
        />
        <button
          onClick={gen} disabled={busy}
          style={{
            padding: "0 20px", background: t.ink, color: t.inv, border: "none",
            fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
            cursor: "pointer", opacity: busy ? 0.3 : 1,
          }}
        >
          {busy ? "…" : "Yasa"}
        </button>
      </div>

      {err && (
        <p style={{ fontSize: 12, color: t.red, borderLeft: `2px solid ${t.red}`, paddingLeft: 12, marginBottom: 14 }}>
          {err}
        </p>
      )}

      {c && (
        <>
          <div
            role="button" tabIndex={0}
            onClick={() => setFlip(!flip)}
            style={{
              minHeight: 210, border: `2px solid ${t.ink}`, display: "grid",
              placeItems: "center", padding: "36px 28px", cursor: "pointer",
              userSelect: "none", textAlign: "center", outline: "none",
            }}
          >
            {!flip ? (
              <div>
                <p style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: 36, lineHeight: 1.2, color: t.ink }}>
                  {c.ru}
                </p>
                <p style={{
                  margin: "18px 0 0", fontFamily: "ui-monospace,monospace", fontSize: 10,
                  letterSpacing: ".18em", textTransform: "uppercase", color: t.faint,
                }}>
                  Space — ochish
                </p>
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, fontFamily: "ui-monospace,monospace", fontSize: 17, color: t.red }}>{c.tr}</p>
                <p style={{ margin: "12px 0 0", fontSize: 23, color: t.ink }}>{c.uz}</p>
                {c.note && <p style={{ margin: "16px 0 0", fontSize: 12, color: t.faint }}>{c.note}</p>}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button onClick={() => go(-1)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
              fontFamily: "ui-monospace,monospace", fontSize: 11, letterSpacing: ".12em",
              textTransform: "uppercase", color: t.dim,
            }}>← Oldingi</button>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Snd text={c.ru} /><Snd text={c.ru} slow />
              <span style={{
                fontFamily: "ui-monospace,monospace", fontSize: 11,
                color: t.faint, fontVariantNumeric: "tabular-nums",
              }}>
                {String(i + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
              </span>
              <Tag on={!!known[c.ru]} onClick={mark}>{known[c.ru] ? "✓ Bildim" : "Bildim"}</Tag>
            </div>

            <button onClick={() => go(1)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
              fontFamily: "ui-monospace,monospace", fontSize: 11, letterSpacing: ".12em",
              textTransform: "uppercase", color: t.dim,
            }}>Keyingi →</button>
          </div>

          <div style={{ marginTop: 14, height: 3, background: t.hair }}>
            <div style={{
              height: "100%", width: `${(learned / cards.length) * 100}%`,
              background: t.red, transition: "width .3s",
            }} />
          </div>

          <p style={{ marginTop: 12, fontSize: 10, color: t.faint }}>
            <K>←</K> <K>→</K> karta · <K>Space</K> aylantir · <K>Enter</K> bildim · <K>A</K> eshit · <K>S</K> sekin
          </p>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TARJIMA
   ════════════════════════════════════════════════════════════════ */
function Trans({ onScore }) {
  const t = useT();
  const [dir, setDir] = useState("ru2uz");
  const [txt, setTxt] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!txt.trim() || busy) return;
    setBusy(true); setRes(null);
    try {
      const raw = await ask([{
        role: "user",
        content: `${dir === "ru2uz" ? "Rus tilidan o'zbek tiliga" : "O'zbek tilidan rus tiliga"} tarjima qil: "${txt}"

Faqat JSON qaytar. Markdown backtick ISHLATMA. Boshqa matn qo'shma.
{
 "ru": "rus tilidagi to'liq matn",
 "tr": "lotin transliteratsiya, urg'uli unliga urg'u belgisi",
 "uz": "o'zbekcha to'liq tarjima",
 "words": [{"w":"rus so'zi","tr":"talaffuzi","uz":"ma'nosi","gram":"grammatik izoh o'zbekcha — kelishik/zamon/rod/son nomi bilan. Kelishikni o'zbek kelishigiga taqqosla."}],
 "note": "bitta muhim grammatik izoh, o'zbekcha"
}`,
      }], "");
      const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!p?.ru) throw new Error("shape");
      setRes(p); onScore(1);
    } catch {
      setRes({ err: "Tahlil qilib bo'lmadi. Qisqaroq matn kirit." });
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", gap: 1, marginBottom: 14 }}>
        <Tag on={dir === "ru2uz"} onClick={() => setDir("ru2uz")}>РУ → UZ</Tag>
        <Tag on={dir === "uz2ru"} onClick={() => setDir("uz2ru")}>UZ → РУ</Tag>
      </div>

      <textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
        rows={3}
        placeholder={dir === "ru2uz" ? "Kitob yoki maqoladan bir gapni tashla…" : "O'zbekcha gap yoz…"}
        style={{
          width: "100%", boxSizing: "border-box", padding: "12px 14px",
          background: "transparent", border: `1px solid ${t.line}`, color: t.ink,
          fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = t.red)}
        onBlur={(e) => (e.target.style.borderColor = t.line)}
      />
      <button
        onClick={run} disabled={busy}
        style={{
          width: "100%", marginTop: 1, padding: "12px 0", background: t.red, color: t.inv,
          border: "none", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
          cursor: "pointer", opacity: busy ? 0.3 : 1,
        }}
      >
        {busy ? "Tahlil qilinmoqda…" : "Yorib tashla"}
        <span style={{ marginLeft: 8, opacity: 0.5, fontFamily: "ui-monospace,monospace", textTransform: "none" }}>⌘↵</span>
      </button>

      {res?.err && (
        <p style={{ marginTop: 16, fontSize: 13, color: t.red, borderLeft: `2px solid ${t.red}`, paddingLeft: 12 }}>
          {res.err}
        </p>
      )}

      {res && !res.err && (
        <div style={{ marginTop: 24 }}>
          <div style={{ borderLeft: `2px solid ${t.red}`, paddingLeft: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <p style={{ flex: 1, margin: 0, fontFamily: "Georgia,serif", fontSize: 23, lineHeight: 1.4, color: t.ink }}>
                {res.ru}
              </p>
              <Snd text={res.ru} /><Snd text={res.ru} slow />
            </div>
            <p style={{ margin: "8px 0 0", fontFamily: "ui-monospace,monospace", fontSize: 13, color: t.red }}>{res.tr}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: t.dim }}>{res.uz}</p>
          </div>

          <p style={{
            margin: "24px 0 8px", fontFamily: "ui-monospace,monospace", fontSize: 9,
            letterSpacing: ".18em", textTransform: "uppercase", color: t.faint,
          }}>
            So'zma-so'z
          </p>
          <div style={{ border: `1px solid ${t.hair}` }}>
            {res.words?.map((w, k) => (
              <div key={k} style={{
                display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px",
                padding: "10px 14px",
                borderBottom: k === res.words.length - 1 ? "none" : `1px solid ${t.hair}`,
              }}>
                <button
                  onClick={() => speak(w.w, 0.75)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "Georgia,serif", fontSize: 18, color: t.ink,
                  }}
                >
                  {w.w}
                </button>
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: t.red }}>{w.tr}</span>
                <span style={{ color: t.faint }}>·</span>
                <span style={{ fontSize: 13, color: t.ink }}>{w.uz}</span>
                {w.gram && (
                  <span style={{ width: "100%", fontSize: 11.5, color: t.faint, marginTop: 2 }}>{w.gram}</span>
                )}
              </div>
            ))}
          </div>

          {res.note && <div style={{ marginTop: 18 }}><Note label="Grammatika">{res.note}</Note></div>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ROOT
   ════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "chat", label: "Suhbat", ru: "разговор" },
  { id: "abc", label: "Alifbo", ru: "алфавит" },
  { id: "voc", label: "So'zlar", ru: "слова" },
  { id: "tr", label: "Tarjima", ru: "перевод" },
];

export default function App() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("chat");
  const [score, setScore] = useState(0);
  const [open, setOpen] = useState(false);

  const [offline, setOffline] = useState(!navigator.onLine);

  const t = dark ? THEME.dark : THEME.light;
  const { all, list, pick, setPick, ready } = useVoices(offline);
  const mic = useMic();

  // Tarmoq uzilsa — offline rejimga o'tamiz (bulut ovozi o'lik bo'ladi)
  useEffect(() => {
    const off = () => setOffline(true);
    window.addEventListener("offline", off);
    return () => window.removeEventListener("offline", off);
  }, []);

  const add = useCallback((n) => setScore((s) => s + n), []);

  useEffect(() => {
    const h = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) setTab(TABS[n - 1].id);
      if (e.key.toLowerCase() === "d") setDark((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <Ctx.Provider value={t}>
      <div style={{
        minHeight: "100vh", background: t.bg, color: t.ink,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        transition: "background .25s",
      }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "28px 20px" }}>

          {/* ── SARLAVHA ── */}
          <header style={{
            display: "flex", alignItems: "flex-end", justifyContent: "space-between",
            paddingBottom: 12, borderBottom: `4px solid ${t.ink}`,
          }}>
            <div>
              <h1 style={{
                margin: 0, fontFamily: "Georgia,serif", fontWeight: 900, fontSize: 36,
                lineHeight: 0.9, letterSpacing: "-.03em", color: t.ink,
              }}>
                РУССКИЙ<span style={{ color: t.red }}>.</span>
              </h1>
              <p style={{
                margin: "7px 0 0", fontFamily: "ui-monospace,monospace", fontSize: 9.5,
                letterSpacing: ".22em", textTransform: "uppercase", color: t.faint,
              }}>
                Elementary · suhbat + o'qish
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{
                  margin: 0, fontFamily: "ui-monospace,monospace", fontWeight: 700,
                  fontSize: 24, lineHeight: 1, color: t.red, fontVariantNumeric: "tabular-nums",
                }}>
                  {String(score).padStart(3, "0")}
                </p>
                <p style={{
                  margin: "4px 0 0", fontFamily: "ui-monospace,monospace", fontSize: 9,
                  letterSpacing: ".18em", textTransform: "uppercase", color: t.faint,
                }}>
                  ball
                </p>
              </div>
              <button
                onClick={() => setDark(!dark)}
                title="Tun / kun (D)"
                style={{
                  width: 36, height: 36, border: `1px solid ${t.line}`, background: "transparent",
                  color: t.ink, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 13,
                }}
              >
                {dark ? "☀" : "☾"}
              </button>
            </div>
          </header>

          {/* ── OVOZ HOLATI ── */}
          {/* ── OVOZ LABORATORIYASI ── */}
          {ready && !all.length && (
            <div style={{ marginTop: 12 }}>
              <Note label="Rus ovozi yo'q" accent>
                <b>Tizimingizda rus TTS ovozi o'rnatilmagan.</b> Brauzer ovozlarni
                operatsion tizimdan oladi — sayt ularni yuklab bera olmaydi.<br /><br />
                <b>Windows:</b> Sozlamalar → Vaqt va til → Nutq → Ovoz qo'shish → Русский<br />
                <b>macOS:</b> System Settings → Accessibility → Spoken Content → System Voice →
                Manage → Russian<br />
                <b>Android:</b> Sozlamalar → Til → Matnni nutqqa → Rus paketini yukla<br /><br />
                Keyin brauzerni <b>qayta ishga tushir</b>.
              </Note>
            </div>
          )}

          {ready && !!all.length && (
            <div style={{ marginTop: 12 }}>
              {/* offline tugmasi */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, flexWrap: "wrap", padding: "9px 12px",
                border: `1px solid ${offline ? t.red : t.hair}`,
                background: offline ? t.tint : "transparent",
              }}>
                <div>
                  <p style={{
                    margin: 0, fontFamily: "ui-monospace,monospace", fontSize: 10,
                    letterSpacing: ".14em", textTransform: "uppercase",
                    color: offline ? t.red : t.faint,
                  }}>
                    {offline ? "◉ Offline ovoz rejimi" : "○ Offline ovoz rejimi"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: t.faint }}>
                    {offline
                      ? "Faqat qurilmadagi ovozlar. Internetsiz ishlaydi."
                      : "Bulut ovozlari ham ko'rinadi — tabiiyroq, lekin internet kerak."}
                  </p>
                </div>
                <Tag on={offline} onClick={() => setOffline(!offline)}>
                  {offline ? "O'chir" : "Yoq"}
                </Tag>
              </div>

              {/* offline yoqilgan, lekin lokal ovoz yo'q */}
              {offline && !list.length && (
                <div style={{ marginTop: 8 }}>
                  <Note label="Offline ovoz yo'q" accent>
                    Rus ovozi bor, lekin hammasi <b>bulut</b> ovozi — internetsiz ishlamaydi.
                    Tizimga lokal rus ovozini o'rnat, yoki offline rejimni o'chir.
                  </Note>
                </div>
              )}

              {/* ovoz ro'yxati — bosilsa DARHOL sinaladi */}
              {!!list.length && (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, marginTop: 10, flexWrap: "wrap",
                  }}>
                    <button
                      onClick={() => setOpen(!open)}
                      style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontFamily: "ui-monospace,monospace", fontSize: 10,
                        letterSpacing: ".14em", textTransform: "uppercase", color: t.faint,
                      }}
                    >
                      Ovoz: {pick?.name} {open ? "▲" : "▼"} ({list.length})
                    </button>
                    <Tag on={false} onClick={() => speak(TEST_LINE, 0.85)}>▶ Sinab ko'r</Tag>
                  </div>

                  {open && (
                    <div style={{ marginTop: 8, border: `1px solid ${t.hair}` }}>
                      {list.map((v, k) => {
                        const on = v.name === pick?.name;
                        return (
                          <button
                            key={v.name + k}
                            onClick={() => { setPick(v); ACTIVE = v; speak(TEST_LINE, 0.85); }}
                            style={{
                              width: "100%", display: "flex", justifyContent: "space-between",
                              alignItems: "center", gap: 8, padding: "9px 12px",
                              background: on ? t.tint : "transparent", border: "none",
                              cursor: "pointer", fontSize: 12, textAlign: "left",
                              color: on ? t.red : t.ink,
                              borderBottom: k === list.length - 1 ? "none" : `1px solid ${t.hair}`,
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 9, color: on ? t.red : t.faint }}>
                                {on ? "●" : "○"}
                              </span>
                              <span>{v.name}</span>
                            </span>
                            <span style={{
                              fontFamily: "ui-monospace,monospace", fontSize: 9,
                              whiteSpace: "nowrap",
                              color: v.localService ? t.ok : t.faint,
                            }}>
                              {v.localService ? "offline ✓" : "internet kerak"}
                            </span>
                          </button>
                        );
                      })}
                      <p style={{
                        margin: 0, padding: "8px 12px", fontSize: 10.5, color: t.faint,
                        borderTop: `1px solid ${t.hair}`, lineHeight: 1.5,
                      }}>
                        Ovozni bos — darhol sinab ko'rasan. Noto'g'ri talaffuz qilsa, boshqasini tanla.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TABLAR ── */}
          <nav style={{ display: "flex", gap: 1, marginTop: 16 }}>
            {TABS.map((x, k) => {
              const on = tab === x.id;
              return (
                <button
                  key={x.id}
                  onClick={() => setTab(x.id)}
                  style={{
                    flex: 1, padding: "10px 0", cursor: "pointer", transition: "all .12s",
                    border: `1px solid ${on ? t.ink : t.line}`,
                    background: on ? t.ink : "transparent",
                    color: on ? t.inv : t.dim,
                  }}
                >
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500, lineHeight: 1 }}>{x.label}</span>
                  <span style={{
                    display: "block", marginTop: 4, fontFamily: "ui-monospace,monospace",
                    fontSize: 8.5, letterSpacing: ".16em", textTransform: "uppercase", opacity: 0.55,
                  }}>
                    {k + 1} · {x.ru}
                  </span>
                </button>
              );
            })}
          </nav>

          <main>
            {tab === "chat" && <Chat onScore={add} mic={mic} />}
            {tab === "abc" && <Abc />}
            {tab === "voc" && <Vocab onScore={add} />}
            {tab === "tr" && <Trans onScore={add} />}
          </main>

          <footer style={{
            marginTop: 24, paddingTop: 12, borderTop: `1px solid ${t.hair}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <p style={{ margin: 0, fontSize: 10, color: t.faint }}>
              <K>1</K>–<K>4</K> bo'lim · <K>D</K> tun/kun
            </p>
            <p style={{
              margin: 0, fontFamily: "ui-monospace,monospace", fontSize: 9.5,
              letterSpacing: ".1em", textTransform: "uppercase",
              color: mic === "ok" ? t.red : t.faint,
            }}>
              {pick ? "ОВОЗ ✓" : "ОВОЗ ✗"} · МИК {mic === "ok" ? "tayyor" : mic === "checking" ? "…" : "yopiq"}
            </p>
          </footer>
        </div>
      </div>
    </Ctx.Provider>
  );
}
