// Tam yenilemede Vuex araması kaybolursa yalnızca kaydedilen sefer aramasını geri koyar.
(() => {
  const KEY = "__tcddSeatWatchResume_v1";
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return; }
  if (!saved) return;
  const remove = () => { try { sessionStorage.removeItem(KEY); } catch {} };
  const NAMES = {98: "ANKARA GAR", 48: "İSTANBUL(PENDİK)"};
  const r = saved.search?.searchRoutes?.[0];
  const validRoute = Number.isInteger(r?.departureStationId) && r.departureStationId > 0 &&
                     Number.isInteger(r?.arrivalStationId) && r.arrivalStationId > 0 &&
                     r.departureStationId !== r.arrivalStationId;
  if (saved.expiresAt < Date.now() || saved.search?.searchRoutes?.length !== 1 ||
      !validRoute ||
      !/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/.test(r?.departureDate || "")) { remove(); return; }
  const deadline = Date.now()+30000;
  const timer = setInterval(() => {
    if (Date.now()>deadline || !["/", "/sefer-listesi"].includes(location.pathname)) { clearInterval(timer); remove(); return; }
    if (/Güvenlik Doğrulaması/i.test(document.body?.innerText || "")) { clearInterval(timer); remove(); return; }
    const access=globalThis.__tcddSeatWatchAccess?.find();
    if (!access?.store || !access.router) return;
    const store = access.store;
    if (!store._mutations?.setSeferSearchInformation) { clearInterval(timer); remove(); return; }
    clearInterval(timer); remove();
    const existing = store.getters.getSeferSearchInformation?.searchRoutes?.[0];
    if (existing?.departureStationId === r.departureStationId && existing?.arrivalStationId === r.arrivalStationId && existing?.departureDate === r.departureDate) return;
    const search = {searchRoutes:[{departureStationId:r.departureStationId, arrivalStationId:r.arrivalStationId,
      departureStationName:r.departureStationName || NAMES[r.departureStationId] || "",
      arrivalStationName:r.arrivalStationName || NAMES[r.arrivalStationId] || "",
      departureDate:r.departureDate}],
      passengerTypeCounts:(saved.search.passengerTypeCounts || []).map(p=>({id:p.id,count:p.count})),
      searchReservation:false, blTrainTypes:["TURISTIK_TREN"]};
    store.commit("setSeferSearchInformation", search);
    // Sayfa zaten bu rotada açılıp boş durumla kurulmuşsa bileşeni yeniden oluştur.
    const route = access.router;
    const navigate = () => route.replace("/sefer-listesi").catch(()=>{});
    if (location.pathname === "/sefer-listesi") route.replace("/").then(navigate).catch(()=>{});
    else navigate();
  }, 50);
})();
