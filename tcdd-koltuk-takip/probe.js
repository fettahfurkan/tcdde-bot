// Chrome bu fonksiyonu sayfanın MAIN dünyasında çalıştırır. Dış değişken kullanmaz.
export function readPage() {
  const cycleKey = globalThis.__tcddSeatWatchCycleKey || "0";
  const documentKey = `${performance.timeOrigin}:${cycleKey}`;
  const text = document.body?.innerText || "";
  if (/Güvenlik Doğrulaması|İşleminizi tamamlamak için lütfen aşağıdaki doğrulamayı/i.test(text)) {
    return {status:"challenge", documentKey, message:"TCDD güvenlik doğrulaması istiyor. Elle tamamlayıp Başlat'a basın."};
  }
  if (globalThis.__tcddSeatWatchCycling) {
    return {status:"loading", documentKey, message:"Sonraki tarihe geçilip tekrar eski tarihe dönülüyor…"};
  }
  const access=globalThis.__tcddSeatWatchAccess?.find();
  const diagnostics=access?.diagnostics || {hasStore:false,hasList:false,readyState:document.readyState,path:location.pathname};
  const store=access?.store,list=access?.listData;
  if (!store) {
    const waiting=document.readyState!=="complete" || performance.now()<8000;
    return {status:waiting?"loading":"unsupported", documentKey, diagnostics,
      message:waiting?"TCDD sayfası yükleniyor…":"Sayfa açık, ancak sefer arayüzü okunamadı. Aşağıdaki tanı bilgisini kontrol edin."};
  }
  const search = store.getters.getSeferSearchInformation;
  if (!search?.searchRoutes?.length || !list) return {status:"no-search", documentKey, diagnostics, message:"TCDD'de sefer listesini açın. Liste zaten açıksa tanı bilgisini paylaşın."};
  if (list.loadingSearch || list.loadingSeferList || list.loadingStations || list.loadingAllStations || list.loadingCities) return {status:"loading", documentKey, message:"Seferler yükleniyor…"};
  const clean = t => ({id:t.id, number:t.number, name:t.name,
    departureStationId:t.departureStationId, arrivalStationId:t.arrivalStationId,
    segments:(t.segments || []).map(s=>({departureTime:s.departureTime})),
    availableFareInfo:(t.availableFareInfo || []).map(f=>({cabinClasses:(f.cabinClasses || []).map(c=>({
      cabinClass:{id:c.cabinClass?.id, code:c.cabinClass?.code}, availabilityCount:c.availabilityCount
    }))}))});
  // Yalnızca güzergâh/tarih/yolcu adetleri ve koltuk sayıları okunur; kimlik veya çerez alınmaz.
  return JSON.parse(JSON.stringify({status:"ready", documentKey, diagnostics,
    search:{searchRoutes:search.searchRoutes.map(r=>({departureStationId:r.departureStationId,
      arrivalStationId:r.arrivalStationId, departureStationName:r.departureStationName || "",
      arrivalStationName:r.arrivalStationName || "", departureDate:r.departureDate})),
      passengerTypeCounts:(search.passengerTypeCounts || []).map(p=>({id:p.id,count:p.count}))},
    trips:list.departureTrainList.map(c=>({trains:(c.trains || []).map(clean)}))}));
}

export function cycleDateRefresh(expectedSearch, cycleId) {
  const access = globalThis.__tcddSeatWatchAccess?.find();
  const store = access?.store, list = access?.list, listData = access?.listData;
  if (!store?.commit || typeof list?.fetchSeferList !== "function" || !listData) {
    return {ok: false};
  }
  const route = expectedSearch?.searchRoutes?.[0];
  if (!route?.departureDate) return {ok: false};
  const currentStoreSearch = store.getters?.getSeferSearchInformation;
  const currentRoute = currentStoreSearch?.searchRoutes?.[0];
  if (!currentRoute || currentStoreSearch.searchRoutes.length !== 1 ||
      currentRoute.departureStationId !== route.departureStationId ||
      currentRoute.arrivalStationId !== route.arrivalStationId ||
      currentRoute.departureDate !== route.departureDate) {
    return {ok: false};
  }

  function shiftDate(departureDate, deltaDays) {
    const [d, m, y, h, mi, s] = departureDate.match(/\d+/g).map(Number);
    const utcMs = Date.UTC(y, m - 1, d, h, mi, s) + deltaDays * 86400000;
    const dt = new Date(utcMs);
    const pad = n => String(n).padStart(2, "0");
    return {
      departureDate: `${pad(dt.getUTCDate())}-${pad(dt.getUTCMonth() + 1)}-${dt.getUTCFullYear()} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`,
      trDay: new Date(utcMs + 3 * 3600000).toISOString().slice(0, 10)
    };
  }

  function highlightSlide(trDay) {
    try {
      const [ty, tm, td] = trDay.split("-").map(Number);
      const dates = Array.isArray(list.sliderGidisDates) ? list.sliderGidisDates : [];
      const idx = dates.findIndex(item => {
        const dt = item instanceof Date ? item : new Date(item);
        return dt.getFullYear() === ty && dt.getMonth() + 1 === tm && dt.getDate() === td;
      });
      const btn = idx >= 0 && typeof document.getElementById === "function" ? document.getElementById(`btnSlickGidis${idx}`) : null;
      const slide = btn?.closest?.(".slick-slide");
      const track = slide?.parentElement;
      if (slide && track) {
        for (const el of track.querySelectorAll(".slick-current, .slick-center")) {
          el.classList.remove("slick-current", "slick-center");
        }
        slide.classList.add("slick-current", "slick-center");
      }
    } catch {}
  }

  function isBusy() {
    return Boolean(list.loadingSearch || listData.loadingSearch || list.loadingSeferList || listData.loadingSeferList);
  }

  function waitIdle(timeoutMs = 25000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise(resolve => {
      const check = () => {
        if (globalThis.__tcddSeatWatchActiveToken !== cycleId || Date.now() >= deadline || !isBusy()) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  async function queryDate(searchObj, trDay) {
    highlightSlide(trDay);
    const payload = JSON.parse(JSON.stringify(searchObj));
    store.commit("setSeferSearchInformation", payload);
    try {
      await Promise.resolve(list.fetchSeferList(JSON.parse(JSON.stringify(payload))));
    } catch {}
    await waitIdle();
  }

  const target = shiftDate(route.departureDate, 0);
  let neighbor = shiftDate(route.departureDate, 1);
  if (list.dayMeta?.[neighbor.trDay]?.available === false) {
    const prev = shiftDate(route.departureDate, -1);
    const todayTr = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    if (prev.trDay >= todayTr && list.dayMeta?.[prev.trDay]?.available !== false) {
      neighbor = prev;
    }
  }

  const baseSearch = JSON.parse(JSON.stringify(currentStoreSearch));
  const neighborSearch = JSON.parse(JSON.stringify(baseSearch));
  neighborSearch.searchRoutes[0].departureDate = neighbor.departureDate;

  globalThis.__tcddSeatWatchActiveToken = cycleId;
  globalThis.__tcddSeatWatchCycling = true;

  (async () => {
    try {
      await waitIdle(10000);
      if (globalThis.__tcddSeatWatchActiveToken !== cycleId) return;
      await queryDate(neighborSearch, neighbor.trDay);
      if (globalThis.__tcddSeatWatchActiveToken !== cycleId) return;
      await new Promise(r => setTimeout(r, 120));
      if (globalThis.__tcddSeatWatchActiveToken !== cycleId) return;
      await queryDate(baseSearch, target.trDay);
    } finally {
      highlightSlide(target.trDay);
      const activeRoute = store.getters?.getSeferSearchInformation?.searchRoutes?.[0];
      if (activeRoute && activeRoute.departureDate !== target.departureDate) {
        try {
          store.commit("setSeferSearchInformation", JSON.parse(JSON.stringify(baseSearch)));
          await Promise.resolve(list.fetchSeferList(JSON.parse(JSON.stringify(baseSearch))));
          await waitIdle(15000);
        } catch {}
      }
      if (globalThis.__tcddSeatWatchActiveToken === cycleId) {
        globalThis.__tcddSeatWatchCycleKey = String(cycleId);
        globalThis.__tcddSeatWatchCycling = false;
        window.dispatchEvent(new CustomEvent("tcdd-watch-ready"));
      }
    }
  })();

  return {ok: true};
}

export function armReload(search, runId) {
  sessionStorage.setItem("__tcddSeatWatchResume_v1", JSON.stringify({search, runId, expiresAt:Date.now()+90000}));
}

export function clearResume() {
  globalThis.__tcddSeatWatchActiveToken = null;
  globalThis.__tcddSeatWatchCycling = false;
  sessionStorage.removeItem("__tcddSeatWatchResume_v1");
}
