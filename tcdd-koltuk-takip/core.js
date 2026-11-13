export const HOST = "https://ebilet.tcddtasimacilik.gov.tr";
export const RESUME_KEY = "__tcddSeatWatchResume_v1";
const NORMAL = new Set(["Y1", "C", "L", "B", "D", "N"]);
const STATIONS = {
  98: {name: "ANKARA GAR", label: "Ankara Gar", short: "Ankara Gar"},
  48: {name: "İSTANBUL(PENDİK)", label: "İstanbul (Pendik)", short: "Pendik"}
};

function titleTr(text) {
  return text
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ")")
    .trim()
    .split(/\s+/)
    .map(word => {
      if (/^(YHT|GAR|TCDD)$/i.test(word)) return word.toLocaleUpperCase("tr-TR") === "GAR" ? "Gar" : word.toLocaleUpperCase("tr-TR");
      return word.replace(/(^|\()([A-Za-zÇĞİÖŞÜçğıöşü])([A-Za-zÇĞİÖŞÜçğıöşü]*)/g,
        (_, prefix, first, rest) => prefix + first.toLocaleUpperCase("tr-TR") + rest.toLocaleLowerCase("tr-TR"));
    })
    .join(" ");
}

function stationMeta(id, rawName) {
  const custom = typeof rawName === "string" ? rawName.trim() : "";
  const preset = STATIONS[id];
  if (preset && (!custom || custom === preset.name)) return preset;
  const name = custom || preset?.name || `İstasyon #${id}`;
  const label = titleTr(name);
  const paren = label.match(/^.+\(([^)]+)\)$/);
  return {name, label, short: paren ? paren[1].trim() : label};
}

export function siteUrl(url) {
  try { return new URL(url).origin === HOST; } catch { return false; }
}

export function sanitizeSearch(search) {
  if (!search || !Array.isArray(search.searchRoutes) || search.searchRoutes.length !== 1) {
    throw new Error("Tek yön TCDD sefer listesini açın.");
  }
  const r = search.searchRoutes[0];
  const validRoute = Number.isInteger(r?.departureStationId) && r.departureStationId > 0 &&
                     Number.isInteger(r?.arrivalStationId) && r.arrivalStationId > 0 &&
                     r.departureStationId !== r.arrivalStationId;
  if (!validRoute) {
    throw new Error("Açık aramada kalkış ve varış istasyonu seçili olmalı.");
  }
  if (typeof r.departureDate !== "string" || !/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/.test(r.departureDate)) {
    throw new Error("Arama tarihi okunamadı; sitede aramayı yeniden yapın.");
  }
  const passengers = search.passengerTypeCounts;
  if (!Array.isArray(passengers) || !passengers.length || passengers.length > 10 ||
      passengers.some(p => !Number.isInteger(p.id) || !Number.isInteger(p.count) || p.count < 0 || p.count > 10)) {
    throw new Error("Yolcu sayısı okunamadı; sitede aramayı yeniden yapın.");
  }
  const from = stationMeta(r.departureStationId, r.departureStationName);
  const to = stationMeta(r.arrivalStationId, r.arrivalStationName);
  return {
    searchRoutes: [{departureStationId: r.departureStationId, arrivalStationId: r.arrivalStationId,
      departureStationName: from.name, arrivalStationName: to.name, departureDate: r.departureDate}],
    passengerTypeCounts: passengers.map(p => ({id:p.id, count:p.count})),
    searchReservation: false, blTrainTypes: ["TURISTIK_TREN"]
  };
}

export function routeInfo(search) {
  const r = sanitizeSearch(search).searchRoutes[0];
  const from = stationMeta(r.departureStationId, r.departureStationName);
  const to = stationMeta(r.arrivalStationId, r.arrivalStationName);
  return {from: from.short, to: to.short, label: `${from.label} → ${to.label}`};
}

export function searchKey(search) {
  const r = sanitizeSearch(search).searchRoutes[0];
  return `${r.departureStationId}/${r.arrivalStationId}/${r.departureDate}`;
}

export function localSearchDate(search) {
  const [d,m,y,h,mi,s] = sanitizeSearch(search).searchRoutes[0].departureDate.match(/\d+/g).map(Number);
  const ms = Date.UTC(y,m-1,d,h,mi,s) + 3*3600000;
  return new Date(ms).toISOString().slice(0,10);
}

export function settings(input = {}) {
  const interval = Number(input.interval ?? 10);
  const start = input.start || "00:00", end = input.end || "23:59";
  const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!Number.isSafeInteger(interval) || interval < 1) throw new Error("Kontrol aralığı en az 1 saniye ve tam sayı olmalı.");
  if (!validTime(start) || !validTime(end) || start > end) throw new Error("Kalkış saati aralığını kontrol edin.");
  return {interval, start, end, sound: input.sound !== false, stopOnFound: input.stopOnFound !== false};
}

export function departure(value) {
  if (typeof value !== "string") throw new Error("Sefer saati eksik.");
  const local = value.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4}) (\d{2}):(\d{2})$/);
  let ms;
  if (local) {
    const [,d,m,y,h,mi] = local;
    ms = Date.parse(`${y.length===2?"20"+y:y}-${m}-${d}T${h}:${mi}:00+03:00`);
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    ms = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + "Z");
  }
  if (!Number.isFinite(ms)) throw new Error("Sefer tarih biçimi tanınmıyor.");
  const tr = new Date(ms + 3*3600000).toISOString();
  return {ms, day:tr.slice(0,10), time:tr.slice(11,16)};
}

export function seatCounts(train) {
  if (!Array.isArray(train.availableFareInfo) || !train.availableFareInfo.length) throw new Error("Koltuk sınıfları eksik; yer yok sonucu çıkarılamaz.");
  const normal = new Map(), disabled = new Map();
  for (const fare of train.availableFareInfo) {
    if (!Array.isArray(fare.cabinClasses) || !fare.cabinClasses.length) throw new Error("Koltuk bilgisi eksik.");
    for (const cabin of fare.cabinClasses) {
      const code = cabin?.cabinClass?.code;
      const count = cabin?.availabilityCount;
      if (!Number.isInteger(count) || count < 0) throw new Error("Koltuk sayısı belirsiz.");
      const target = code === "DSB" ? disabled : NORMAL.has(code) ? normal : null;
      if (!target) throw new Error(`Tanınmayan koltuk sınıfı: ${code || "boş"}.`);
      const key = `${code}:${cabin.cabinClass.id ?? code}`;
      target.set(key, Math.max(target.get(key) || 0, count));
    }
  }
  return {normal:[...normal.values()].reduce((a,b)=>a+b,0), wheelchair:[...disabled.values()].reduce((a,b)=>a+b,0)};
}

export function evaluate(snapshot, config, expectedSearch, now = Date.now()) {
  if (snapshot.status !== "ready") throw new Error(snapshot.message || "Sefer listesi hazır değil.");
  const expectedRoute = sanitizeSearch(expectedSearch).searchRoutes[0];
  if (searchKey(snapshot.search) !== searchKey(expectedSearch)) throw new Error("Tarih veya güzergâh değişti. Doğru aramada takibi yeniden başlatın.");
  const day = localSearchDate(expectedSearch);
  if (!Array.isArray(snapshot.trips)) throw new Error("Sefer listesi okunamadı.");
  const result = new Map();
  for (const choice of snapshot.trips) {
    if (!Array.isArray(choice.trains) || !choice.trains.length) throw new Error("Sefer bilgisi eksik.");
    if (choice.trains.length !== 1) continue;
    const train = choice.trains[0];
    if (train.departureStationId !== expectedRoute.departureStationId || train.arrivalStationId !== expectedRoute.arrivalStationId) throw new Error("Sefer güzergâhı eşleşmiyor.");
    const dt = departure(train.segments?.[0]?.departureTime);
    if (dt.day !== day || dt.time < config.start || dt.time > config.end || dt.ms <= now) continue;
    if (train.id == null) throw new Error("Sefer kimliği eksik.");
    const counts = seatCounts(train);
    const trip = {key:`${train.id}/${dt.ms}`, name:String(train.number || train.name || train.id), time:dt.time, ...counts};
    const old = result.get(trip.key);
    if (old && JSON.stringify(old) !== JSON.stringify(trip)) throw new Error("Aynı sefer için çelişkili sayılar alındı.");
    result.set(trip.key, trip);
  }
  return [...result.values()].sort((a,b)=>a.time.localeCompare(b.time));
}
