/* Ezan Vakti, Kaza, Borç Defteri – Ezan vakitleri ve Zikirmatik
   Ana dosyadaki V (veri), kaydet(), toast(), $(), sayiFmt(), ciz() ve paylas() kullanılır. */
"use strict";

/* ===================== EZAN VAKİTLERİ ===================== */
// Kaynak: ezanvakti.emushaf.net (Diyanet'in sitesindeki vakitlerin aynısı). Yedek: Aladhan, Diyanet yöntemi (method=13).
const EV_API = "https://ezanvakti.emushaf.net";
const EV_VAKITLER = [
  ["imsak", "İmsak", "Imsak", "Fajr"],
  ["gunes", "Güneş", "Gunes", "Sunrise"],
  ["ogle", "Öğle", "Ogle", "Dhuhr"],
  ["ikindi", "İkindi", "Ikindi", "Asr"],
  ["aksam", "Akşam", "Aksam", "Maghrib"],
  ["yatsi", "Yatsı", "Yatsi", "Isha"],
];
let evSayacZamanlayici = null;
let evYukleniyor = false;

function evVeri() {
  // Eksik alanları yerinde tamamla (yeni nesne oluşturma: başka yerlerdeki referanslar bozulmasın)
  const v = V.vakit || (V.vakit = {});
  const v0 = { sehirId: null, sehirAdi: "", ilceId: null, ilceAdi: "", gunler: [], alinma: null, onceDk: 0 };
  for (const k in v0) if (v[k] === undefined) v[k] = v0[k];
  v.bildirim = v.bildirim || {};
  for (const [k] of EV_VAKITLER) if (v.bildirim[k] === undefined) v.bildirim[k] = false;
  return v;
}

async function evGetir(yol) {
  const r = await fetch(EV_API + yol, { cache: "no-store" });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

const ikiHane = (n) => String(n).padStart(2, "0");
const evTarihAnahtar = (d) => `${ikiHane(d.getDate())}.${ikiHane(d.getMonth() + 1)}.${d.getFullYear()}`;
function evZaman(gunStr, saat) { // "08.11.2026", "12:52" → Date (telefonun saatine göre)
  const [g, a, y] = gunStr.split(".").map(Number);
  const [s, d] = String(saat).slice(0, 5).split(":").map(Number);
  return new Date(y, a - 1, g, s, d, 0);
}

async function evVakitleriIndir(sessiz) {
  const v = evVeri();
  if (!v.ilceId || evYukleniyor) return;
  evYukleniyor = true;
  try {
    let gunler;
    try {
      const d = await evGetir("/vakitler/" + v.ilceId);
      gunler = d.map((x) => ({ tarih: x.MiladiTarihKisa, hicri: x.HicriTarihUzun || "", imsak: x.Imsak, gunes: x.Gunes, ogle: x.Ogle, ikindi: x.Ikindi, aksam: x.Aksam, yatsi: x.Yatsi }));
    } catch (e) {
      // Yedek kaynak: Aladhan (Diyanet yöntemi). Bu ay + gelecek ay.
      gunler = [];
      const simdi = new Date();
      for (let k = 0; k < 2; k++) {
        const t = new Date(simdi.getFullYear(), simdi.getMonth() + k, 1);
        const url = `https://api.aladhan.com/v1/calendarByCity/${t.getFullYear()}/${t.getMonth() + 1}?city=${encodeURIComponent(v.ilceAdi || v.sehirAdi)}&country=Turkey&method=13`;
        const r = await fetch(url); if (!r.ok) throw new Error("yedek http " + r.status);
        const j = await r.json();
        j.data.forEach((g) => {
          const [gg, aa, yy] = g.date.gregorian.date.split("-");
          const t2 = g.timings;
          gunler.push({ tarih: `${gg}.${aa}.${yy}`, hicri: `${g.date.hijri.day} ${g.date.hijri.month.en} ${g.date.hijri.year}`,
            imsak: t2.Fajr.slice(0, 5), gunes: t2.Sunrise.slice(0, 5), ogle: t2.Dhuhr.slice(0, 5), ikindi: t2.Asr.slice(0, 5), aksam: t2.Maghrib.slice(0, 5), yatsi: t2.Isha.slice(0, 5) });
        });
      }
    }
    if (!gunler.length) throw new Error("boş");
    v.gunler = gunler; v.alinma = new Date().toISOString();
    kaydet();
    evBildirimKur();
    if (!sessiz) toast("Vakitler güncellendi");
  } catch (e) {
    if (!sessiz) toast("Vakitler alınamadı. İnternetini kontrol et.");
  } finally {
    evYukleniyor = false;
    if (sayfa === "vakit") ciz();
  }
}

// Bugünden itibaren kaç gün kaldı? 7 günden azsa arka planda yenile
function evGuncelMi() {
  const v = evVeri();
  if (!v.ilceId) return true;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const ileri = v.gunler.filter((g) => evZaman(g.tarih, "00:00") >= bugun).length;
  return ileri >= 7;
}

function evBugun() {
  const v = evVeri();
  return v.gunler.find((g) => g.tarih === evTarihAnahtar(new Date()));
}
function evSonraki() { // bir sonraki vakit (bugün yoksa yarının imsakı)
  const v = evVeri(), simdi = new Date();
  for (const g of v.gunler) {
    for (const [k, ad] of EV_VAKITLER) {
      const z = evZaman(g.tarih, g[k]);
      if (z > simdi) return { anahtar: k, ad, zaman: z, gun: g };
    }
  }
  return null;
}
function evSuanki() { // şu an hangi vaktin içindeyiz
  const g = evBugun(); if (!g) return null;
  const simdi = new Date(); let son = null;
  for (const [k] of EV_VAKITLER) if (evZaman(g.tarih, g[k]) <= simdi) son = k;
  return son;
}
function evKalan(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${ikiHane(Math.floor(t / 3600))}:${ikiHane(Math.floor((t % 3600) / 60))}:${ikiHane(t % 60)}`;
}

function vakitSayfasi() {
  $("#baslik").textContent = "Ezan Vakitleri";
  const v = evVeri();
  clearInterval(evSayacZamanlayici);
  if (!v.ilceId) return evKonumSec();
  const g = evBugun(), son = evSonraki(), suan = evSuanki();
  let h = "";
  if (!g) {
    h += `<div class="kart bos">${evYukleniyor ? "Vakitler indiriliyor…" : "Bugünün vakitleri yok."}<br><br><button class="btn" id="evYenile">🔄 Vakitleri indir</button></div>`;
  } else {
    h += `<div class="kart ozet ev-ust">
      <small>📍 ${kacis(v.ilceAdi)}${v.ilceAdi !== v.sehirAdi ? " / " + kacis(v.sehirAdi) : ""} · ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</small>
      <div class="ev-sonraki">${son ? son.ad + " vaktine" : ""}</div>
      <div class="buyuk ev-sayac" id="evSayac">${son ? evKalan(son.zaman - new Date()) : "--:--:--"}</div>
      <small>${kacis(g.hicri)}</small>
    </div>
    <div class="kart">`;
    for (const [k, ad] of EV_VAKITLER) {
      h += `<div class="ev-satir ${suan === k ? "ev-aktif" : ""} ${son && son.anahtar === k && son.gun === g ? "ev-siradaki" : ""}"><span>${ad}</span><b>${g[k]}</b></div>`;
    }
    h += `</div>`;
  }
  // Bildirimler
  const bil = v.bildirim, bildirimVar = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications);
  h += `<div class="kart"><h3>🔔 Vakit bildirimleri</h3>
    <p class="not-kutu" style="margin-top:0">Seçtiğin vakitlerde telefonuna bildirim gelir. İnternet olmasa da çalışır.</p>
    <div class="secim" id="evBil">${EV_VAKITLER.map(([k, ad]) => `<button data-k="${k}" class="${bil[k] ? "sec" : ""}">${ad}</button>`).join("")}</div>
    <label>Ne zaman haber verilsin?</label>
    <div class="secim" id="evOnce">${[0, 10, 15, 30, 45].map((d) => `<button data-d="${d}" class="${v.onceDk === d ? "sec" : ""}">${d ? d + " dk önce" : "Vaktinde"}</button>`).join("")}</div>
    ${bildirimVar ? "" : `<p class="not-kutu">Bildirimler telefona kurulan uygulamada çalışır.</p>`}
  </div>`;
  // Aylık liste
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const ileri = v.gunler.filter((x) => evZaman(x.tarih, "00:00") >= bugun);
  if (ileri.length) {
    h += `<div class="kart"><h3>📅 İmsakiye</h3><div class="ev-tablo"><div class="ev-th"><span>Tarih</span>${EV_VAKITLER.map(([, ad]) => `<span>${ad}</span>`).join("")}</div>`;
    for (const x of ileri) h += `<div class="ev-tr ${x === g ? "ev-bugun" : ""}"><span>${x.tarih.slice(0, 5)}</span>${EV_VAKITLER.map(([k]) => `<span>${x[k]}</span>`).join("")}</div>`;
    h += `</div></div>`;
  }
  h += `<div class="ikili"><button class="btn ikincil" id="evDegis">📍 Konumu değiştir</button><button class="btn ikincil" id="evYenile2">🔄 Yenile</button></div>
    <p class="not-kutu" style="text-align:center">Vakitler Diyanet İşleri Başkanlığı verileridir.${v.alinma ? " Son güncelleme: " + new Date(v.alinma).toLocaleDateString("tr-TR") : ""}</p>`;
  $("#icerik").innerHTML = h;
  const y = $("#evYenile"); if (y) y.onclick = () => evVakitleriIndir(false);
  $("#evYenile2").onclick = () => evVakitleriIndir(false);
  $("#evDegis").onclick = evKonumSec;
  document.querySelectorAll("#evBil button").forEach((b) => (b.onclick = async () => {
    bil[b.dataset.k] = !bil[b.dataset.k]; kaydet();
    if (bil[b.dataset.k]) await evBildirimIzni();
    evBildirimKur(); ciz();
  }));
  document.querySelectorAll("#evOnce button").forEach((b) => (b.onclick = () => { v.onceDk = +b.dataset.d; kaydet(); evBildirimKur(); ciz(); }));
  // Geri sayım her saniye
  if (son) evSayacZamanlayici = setInterval(() => {
    const el = $("#evSayac"); if (!el || sayfa !== "vakit") return clearInterval(evSayacZamanlayici);
    const kalan = son.zaman - new Date();
    if (kalan <= 0) { clearInterval(evSayacZamanlayici); ciz(); } else el.textContent = evKalan(kalan);
  }, 1000);
  if (!evGuncelMi()) evVakitleriIndir(true);
}

let evSehirler = null;
async function evKonumSec() {
  clearInterval(evSayacZamanlayici);
  $("#baslik").textContent = "Konum seç";
  $("#icerik").innerHTML = `<div class="kart"><h3>📍 Hangi ilçenin vakitlerini görmek istersin?</h3>
    <p class="not-kutu" style="margin-top:0">Vakitler Diyanet'in ilçe vakitleridir. Büyükşehirlerde merkez ilçeler çoğunlukla il adıyla geçer (ör. Yıldırım için “BURSA”).</p>
    <label>İl</label><select id="evIl"><option>Yükleniyor…</option></select>
    <label>İlçe</label><select id="evIlce" disabled><option>Önce il seç</option></select>
    <div style="margin-top:16px"><button class="btn" id="evKaydet" disabled>Kaydet ve vakitleri indir</button></div></div>`;
  try {
    evSehirler = evSehirler || (await evGetir("/sehirler/2"));
    const v = evVeri();
    $("#evIl").innerHTML = `<option value="">İl seç</option>` + evSehirler.map((s) => `<option value="${s.SehirID}" ${s.SehirID === v.sehirId ? "selected" : ""}>${kacis(s.SehirAdi)}</option>`).join("");
    const ilceDoldur = async () => {
      const id = $("#evIl").value; $("#evKaydet").disabled = true;
      if (!id) return;
      $("#evIlce").innerHTML = "<option>Yükleniyor…</option>";
      const ilceler = await evGetir("/ilceler/" + id);
      const ilAd = evSehirler.find((s) => s.SehirID === id).SehirAdi;
      ilceler.sort((a, b) => (b.IlceAdi === ilAd) - (a.IlceAdi === ilAd) || a.IlceAdi.localeCompare(b.IlceAdi, "tr"));
      $("#evIlce").innerHTML = ilceler.map((x) => `<option value="${x.IlceID}" ${x.IlceID === v.ilceId ? "selected" : ""}>${kacis(x.IlceAdi)}</option>`).join("");
      $("#evIlce").disabled = false; $("#evKaydet").disabled = false;
    };
    $("#evIl").onchange = () => ilceDoldur().catch(() => toast("İlçeler alınamadı"));
    if (v.sehirId) await ilceDoldur();
    $("#evKaydet").onclick = () => {
      const il = $("#evIl"), ilce = $("#evIlce");
      Object.assign(v, { sehirId: il.value, sehirAdi: il.options[il.selectedIndex].text, ilceId: ilce.value, ilceAdi: ilce.options[ilce.selectedIndex].text, gunler: [] });
      kaydet(); ciz(); evVakitleriIndir(false);
    };
  } catch (e) {
    $("#evIl").innerHTML = "<option>Liste alınamadı</option>";
    toast("İnternet bağlantısı gerekiyor");
  }
}

/* --- Bildirimler (telefona kurulu uygulamada) --- */
function evBildirimEklentisi() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; }
async function evBildirimIzni() {
  const LN = evBildirimEklentisi(); if (!LN) return false;
  try {
    let d = await LN.checkPermissions();
    if (d.display !== "granted") d = await LN.requestPermissions();
    if (d.display !== "granted") { toast("Bildirim izni verilmedi"); return false; }
    return true;
  } catch (e) { return false; }
}
async function evBildirimKur() {
  const LN = evBildirimEklentisi(); if (!LN) return;
  const v = evVeri();
  try {
    const bekleyen = await LN.getPending();
    const eski = (bekleyen.notifications || []).filter((n) => n.id >= 1000 && n.id < 3000).map((n) => ({ id: n.id }));
    if (eski.length) await LN.cancel({ notifications: eski });
    if (!Object.values(v.bildirim).some(Boolean)) return;
    const izin = await LN.checkPermissions(); if (izin.display !== "granted") return;
    const simdi = new Date(), liste = [];
    let id = 1000;
    for (const g of v.gunler) {
      for (const [k, ad] of EV_VAKITLER) {
        if (!v.bildirim[k]) continue;
        const z = new Date(evZaman(g.tarih, g[k]).getTime() - v.onceDk * 60000);
        if (z <= simdi || z - simdi > 8 * 864e5) continue;
        liste.push({ id: id++, title: v.onceDk ? `${ad} vaktine ${v.onceDk} dakika kaldı` : `🕌 ${ad} vakti`,
          body: `${v.ilceAdi} · ${ad}: ${g[k]}`, schedule: { at: z, allowWhileIdle: true }, smallIcon: "ic_stat_cami", iconColor: "#0E4D3A" });
      }
    }
    if (liste.length) await LN.schedule({ notifications: liste });
  } catch (e) { /* bildirim kurulamazsa uygulama çalışmaya devam eder */ }
}

/* ===================== ZİKİRMATİK ===================== */
const ZK_HAZIR = [
  ["subhanallah", "Sübhanallah", 33], ["elhamdulillah", "Elhamdülillah", 33], ["allahuekber", "Allahu Ekber", 33],
  ["lailaheillallah", "Lâ ilâhe illallah", 100], ["estagfirullah", "Estağfirullah", 100], ["salavat", "Salavat-ı Şerife", 100],
];
function zkVeri() {
  const z = V.zikir || (V.zikir = {});
  if (!Array.isArray(z.liste) || !z.liste.length) z.liste = ZK_HAZIR.map(([id, ad, hedef]) => ({ id, ad, hedef, sayi: 0, tur: 0, toplam: 0 }));
  if (!z.aktif) z.aktif = z.liste[0].id;
  if (z.titresim === undefined) z.titresim = true;
  const bugunStr = new Date().toLocaleDateString("tr-TR");
  if (!z.gun || z.gun.tarih !== bugunStr) z.gun = { tarih: bugunStr, toplam: 0 };
  return z;
}
const zkAktif = () => { const z = zkVeri(); return z.liste.find((x) => x.id === z.aktif) || z.liste[0]; };
const zkTitre = (ms) => { if (zkVeri().titresim) try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

function zikirSayfasi() {
  $("#baslik").textContent = "Zikirmatik";
  const z = zkVeri(), a = zkAktif();
  const oran = a.hedef ? Math.min(1, a.sayi / a.hedef) : 0, R = 120, C = 2 * Math.PI * R;
  let h = `<div class="secim zk-liste">${z.liste.map((x) => `<button data-id="${x.id}" class="${x.id === a.id ? "sec" : ""}">${kacis(x.ad)}</button>`).join("")}<button id="zkYeni">＋ Ekle</button></div>
  <div class="zk-alan" id="zkAlan">
    <svg viewBox="0 0 280 280" class="zk-halka"><circle cx="140" cy="140" r="${R}" class="zk-iz"/><circle cx="140" cy="140" r="${R}" class="zk-dolu" id="zkHalka" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - oran)}"/></svg>
    <div class="zk-orta"><div class="zk-ad">${kacis(a.ad)}</div><div class="zk-sayi" id="zkSayi">${a.sayi}</div><div class="zk-hedef" id="zkHedef">${a.hedef ? "/ " + a.hedef : "hedefsiz"}${a.tur ? ` · ${a.tur}. tur bitti` : ""}</div></div>
  </div>
  <p class="not-kutu" style="text-align:center;margin:4px 0 10px">Daireye dokun, her dokunuş bir zikir</p>
  <div class="ikili" style="margin-bottom:12px"><button class="btn ikincil" id="zkGeri">↶ Geri al</button><button class="btn ikincil" id="zkSifir">↺ Sıfırla</button></div>
  <div class="kart"><h3>🎯 Hedef</h3><div class="secim" id="zkHedefSec">${[33, 99, 100, 500, 1000, 0].map((n) => `<button data-n="${n}" class="${a.hedef === n ? "sec" : ""}">${n || "Hedefsiz"}</button>`).join("")}</div></div>
  <div class="kart"><h3>📊 İstatistik</h3>
    <div class="ev-satir"><span>Bugün toplam (bütün zikirler)</span><b id="zkGun">${sayiFmt(z.gun.toplam, 0)}</b></div>
    <div class="ev-satir"><span>${kacis(a.ad)} – tüm zamanlar</span><b id="zkToplam">${sayiFmt(a.toplam, 0)}</b></div>
    <div class="ev-satir"><span>Dokunuşta titreşim</span><button class="btn kucuk ${z.titresim ? "" : "ikincil"}" id="zkTit">${z.titresim ? "Açık" : "Kapalı"}</button></div>
    ${ZK_HAZIR.some(([id]) => id === a.id) ? "" : `<div style="margin-top:10px"><button class="btn tehlike" id="zkSil">Bu zikri sil</button></div>`}
  </div>`;
  $("#icerik").innerHTML = h;
  const guncelle = () => {
    $("#zkSayi").textContent = a.sayi;
    $("#zkHedef").textContent = (a.hedef ? "/ " + a.hedef : "hedefsiz") + (a.tur ? ` · ${a.tur}. tur bitti` : "");
    $("#zkHalka").style.strokeDashoffset = C * (1 - (a.hedef ? Math.min(1, a.sayi / a.hedef) : 0));
    $("#zkGun").textContent = sayiFmt(z.gun.toplam, 0); $("#zkToplam").textContent = sayiFmt(a.toplam, 0);
  };
  $("#zkAlan").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    zkVeri(); // gün değiştiyse günlük toplam sıfırlansın
    a.sayi++; a.toplam++; z.gun.toplam++;
    const el = $("#zkAlan"); el.classList.remove("zk-tik"); void el.offsetWidth; el.classList.add("zk-tik");
    if (a.hedef && a.sayi >= a.hedef) {
      a.tur++; a.sayi = 0; zkTitre([80, 60, 200]);
      toast(`🎉 ${a.hedef} tamamlandı! (${a.tur}. tur)`);
    } else zkTitre(18);
    kaydet(); guncelle();
  });
  $("#zkGeri").onclick = () => { if (a.sayi > 0) { a.sayi--; a.toplam = Math.max(0, a.toplam - 1); z.gun.toplam = Math.max(0, z.gun.toplam - 1); kaydet(); guncelle(); } };
  $("#zkSifir").onclick = () => { if (a.sayi === 0 && !a.tur) return; if (confirm(`${a.ad} sayacı sıfırlansın mı?`)) { a.sayi = 0; a.tur = 0; kaydet(); ciz(); } };
  $("#zkTit").onclick = () => { z.titresim = !z.titresim; kaydet(); ciz(); };
  document.querySelectorAll(".zk-liste button[data-id]").forEach((b) => (b.onclick = () => { z.aktif = b.dataset.id; kaydet(); ciz(); }));
  document.querySelectorAll("#zkHedefSec button").forEach((b) => (b.onclick = () => { a.hedef = +b.dataset.n; if (a.hedef && a.sayi >= a.hedef) a.sayi = 0; kaydet(); ciz(); }));
  $("#zkYeni").onclick = () => {
    const ad = (prompt("Zikrin adı (ör. Hasbünallah)") || "").trim().slice(0, 30);
    if (!ad) return;
    const yeni = { id: "ozel" + Date.now().toString(36), ad, hedef: 33, sayi: 0, tur: 0, toplam: 0 };
    z.liste.push(yeni); z.aktif = yeni.id; kaydet(); ciz();
  };
  const sil = $("#zkSil"); if (sil) sil.onclick = () => { if (confirm(`${a.ad} silinsin mi?`)) { z.liste = z.liste.filter((x) => x.id !== a.id); z.aktif = z.liste[0].id; kaydet(); ciz(); } };
}
