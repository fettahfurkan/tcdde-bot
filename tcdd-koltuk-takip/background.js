import {HOST, siteUrl, sanitizeSearch, routeInfo, searchKey, localSearchDate, settings, evaluate} from "./core.js";
import {readPage, cycleDateRefresh, armReload, clearResume} from "./probe.js";
import {TELEGRAM_ALARM,queueSeatAlert,telegramView,connectTelegram,setTelegramEnabled,disconnectTelegram,testTelegram,flushTelegram} from "./telegram-service.js";

const REFRESH = "tcdd-refresh", DEADLINE = "tcdd-load-deadline";
const idle = () => ({enabled:false, phase:"idle", message:"TCDD sefer listesini açıp Başlat'a basın.", trips:[], count:0});
let queue = Promise.resolve(), creatingAudio;
export function serial(work) { const result = queue.then(work); queue = result.catch(()=>{}); return result; }
const get = async () => (await chrome.storage.local.get("watch")).watch || idle();
async function save(state) {
  await chrome.storage.local.set({watch:state});
  const text = state.phase === "found" ? "VAR" : state.phase === "paused" ? "!" : state.enabled ? "ON" : "";
  await chrome.action.setBadgeText({text});
  await chrome.action.setBadgeBackgroundColor({color:state.phase === "found" ? "#15803d" : state.phase === "paused" ? "#b45309" : "#164e63"});
}
async function clearAlarms() { await chrome.alarms.clear(REFRESH); await chrome.alarms.clear(DEADLINE); }
async function pageTimer(state,cancel=false) {
  if(!state.tabId)return;
  const payload={type:cancel?"CANCEL_REFRESH":"SCHEDULE_REFRESH",runId:state.runId,dueAt:state.nextCheck};
  try {await chrome.tabs.sendMessage(state.tabId,payload);}
  catch {
    if(cancel)return;
    try {
      await chrome.scripting.executeScript({target:{tabId:state.tabId},files:["page-ready.js"]});
      await chrome.tabs.sendMessage(state.tabId,payload);
    } catch {}
  }
}
async function probe(tabId) {
  // Eklenti kurulduğunda zaten açık olan sekmelere de okuyucuyu yükler.
  await chrome.scripting.executeScript({target:{tabId},world:"MAIN",files:["page-access.js"]});
  const results = await chrome.scripting.executeScript({target:{tabId}, world:"MAIN", func:readPage});
  return results[0]?.result || {status:"loading", message:"Sayfa henüz okunamadı."};
}
async function call(tabId, func, args=[]) { return chrome.scripting.executeScript({target:{tabId}, world:"MAIN", func, args}); }
async function notification(title, message, alert=false) {
  await chrome.notifications.create("tcdd-watch", {type:"basic", iconUrl:"icon.png", title,
    message, priority:1, requireInteraction:true, silent:!alert});
}
async function sound() {
  const exists = await chrome.runtime.getContexts({contextTypes:["OFFSCREEN_DOCUMENT"], documentUrls:[chrome.runtime.getURL("audio.html")]});
  if (!exists.length) {
    if (!creatingAudio) creatingAudio = chrome.offscreen.createDocument({url:"audio.html", reasons:["AUDIO_PLAYBACK"], justification:"Normal koltuk bulunduğunda kullanıcının istediği sesli uyarıyı çalmak."}).finally(()=>{creatingAudio=null;});
    await creatingAudio;
  }
  let result;
  // Belge oluşturulması ile ses dinleyicisinin hazır olması arasındaki kısa aralığı bekle.
  for(let attempt=0;attempt<10;attempt++) {
    try { result=await chrome.runtime.sendMessage({target:"audio", type:"PLAY"});break; }
    catch(e) { if(attempt===9) throw e; await new Promise(resolve=>setTimeout(resolve,100)); }
  }
  if (!result?.ok) throw new Error("Ses çalınamadı. Eklentide Uyarıyı dene düğmesini kullanın.");
}
async function pause(state, message, inform=true) {
  state.enabled=false; state.phase="paused"; state.message=message; state.nextCheck=null;
  await clearAlarms();
  await pageTimer(state,true);
  try { await call(state.tabId, clearResume); } catch {}
  await save(state);
  if (inform) try { await notification("TCDD takip duraklatıldı", message); } catch {}
  return state;
}
async function schedule(state) {
  state.nextCheck=Date.now()+state.config.interval*1000;
  await save(state);
  await chrome.alarms.create(REFRESH, {when:state.nextCheck});
  await pageTimer(state);
}

export async function start(tabId, input) {
  const tab = await chrome.tabs.get(tabId);
  if (!siteUrl(tab.url) || new URL(tab.url).pathname !== "/sefer-listesi") throw new Error("Önce TCDD'de sefer listesini açın.");
  const snapshot = await probe(tabId);
  if (snapshot.status !== "ready") throw new Error(snapshot.message || "Sefer listesi hazır değil.");
  const search = sanitizeSearch(snapshot.search), config = settings(input);
  if (!snapshot.trips.length) throw new Error("Sefer listesi boş. Sitedeki arama sonucunu kontrol edin.");
  // İlk sonuç uyarı için kullanılmaz; hemen tam yenileme yapılıp yeni belge okunur.
  evaluate(snapshot, config, search);
  await chrome.storage.local.set({preferences:config});
  const old = await get();
  await pageTimer(old,true);
  if (old.tabId && old.tabId !== tabId) try { await call(old.tabId, clearResume); } catch {}
  await clearAlarms();
  const state = {...idle(), enabled:true, runId:crypto.randomUUID(), tabId, search, config,
    day:localSearchDate(search), phase:"waiting", message:"İlk kontrol için sayfa yenileniyor…", lastAvailable:[]};
  await save(state);
  try { await reload(state, snapshot); }
  catch(e) { await pause(state,e.message,false); throw e; }
  return get();
}

function watchCycle(tabId, runId, count) {
  const poll = (attempt = 0) => {
    setTimeout(() => {
      serial(async () => {
        const current = await get();
        if (!current.enabled || current.tabId !== tabId || current.runId !== runId ||
            current.count !== count || current.phase !== "reloading") return;
        await inspect(tabId);
        const after = await get();
        if (after.enabled && after.tabId === tabId && after.runId === runId &&
            after.count === count && after.phase === "reloading" && attempt < 120) {
          poll(attempt + 1);
        }
      }).catch(() => {});
    }, 300);
  };
  poll(0);
}

async function reload(state, snapshot) {
  if (!state.enabled) return;
  const tab = await chrome.tabs.get(state.tabId);
  if (!siteUrl(tab.url) || new URL(tab.url).pathname !== "/sefer-listesi") return pause(state, "Sefer listesinden ayrıldınız. Takip durdu.");
  snapshot ||= await probe(state.tabId);
  if (snapshot.status !== "ready") return pause(state, snapshot.message || "Sayfa hazır değil; aramayı kontrol edin.");
  if (searchKey(snapshot.search) !== searchKey(state.search)) return pause(state, "Tarih veya güzergâh değişti. Takibi doğru aramada yeniden başlatın.");
  await call(state.tabId, armReload, [state.search, state.runId]);
  state.previousDocument=snapshot.documentKey;
  state.phase="reloading"; state.nextCheck=null; state.loadingSince=Date.now(); state.count++;
  state.message=`Kontrol ${state.count}: sonraki tarihe geçilip tekrar eski tarihe dönülüyor…`;
  await save(state);
  await chrome.alarms.create(DEADLINE, {when:Date.now()+70000});
  try {
    const cycleId = `${state.runId}:${state.count}`;
    const cycled = await call(state.tabId, cycleDateRefresh, [state.search, cycleId]);
    if (cycled?.[0]?.result?.ok) {
      watchCycle(state.tabId, state.runId, state.count);
    } else {
      await chrome.tabs.reload(state.tabId, {bypassCache:true});
    }
  }
  catch { await pause(state, "Sekme yenilenemedi. TCDD sekmesini kontrol edin."); }
}

export async function inspect(tabId) {
  const state = await get();
  if (!state.enabled || state.tabId !== tabId || state.phase !== "reloading") return;
  const tab = await chrome.tabs.get(tabId);
  if (!siteUrl(tab.url)) return pause(state,"TCDD sekmesinden ayrıldınız. Takip durdu.");
  const path = new URL(tab.url).pathname;
  if (!["/", "/sefer-listesi"].includes(path)) return pause(state,"Sefer listesinden ayrıldınız. Takip durdu.");
  const snapshot = await probe(tabId);
  if (snapshot.status === "challenge") return pause(state,snapshot.message);
  if (snapshot.status !== "ready" || snapshot.documentKey === state.previousDocument) return;
  let trips;
  try {
    if (!snapshot.trips.length) throw new Error("Sefer listesi boş; sorgu sonucu doğrulanamadı. Sitedeki aramayı kontrol edin.");
    trips=evaluate(snapshot,state.config,state.search);
  } catch (error) { return pause(state,error.message); }
  await chrome.alarms.clear(DEADLINE);
  const available=trips.filter(t=>t.normal>0);
  const fresh=available.filter(t=>!state.lastAvailable.includes(t.key));
  state.lastAvailable=available.map(t=>t.key); state.trips=trips; state.lastCheck=Date.now();
  state.lastSnapshot={status:"ready",documentKey:snapshot.documentKey,search:snapshot.search,trips:snapshot.trips};
  state.message=available.length ? `${available.length} seferde normal koltuk var.` : trips.length ? "Normal koltuk yok. Tekerlekli sandalye yerleri hariç." : "Seçilen saatlerde henüz kalkmamış direkt sefer yok.";
  if (available.length && state.config.stopOnFound) {
    state.enabled=false; state.phase="found"; state.nextCheck=null;
    state.message+=" Yenileme durduruldu.";
    await clearAlarms();
    await pageTimer(state,true);
  } else { state.phase="waiting"; }
  await save(state);
  if (fresh.length) {
    const message=fresh.slice(0,5).map(t=>`${t.time} · ${t.name}: ${t.normal} normal koltuk`).join("\n");
    const warnings=[];
    try { await notification("TCDD — Normal koltuk bulundu", message,true); } catch { warnings.push("Masaüstü bildirimi gösterilemedi."); }
    if (state.config.sound) try { await sound(); } catch (e) { warnings.push(e.message); }
    try {await queueSeatAlert({day:state.day,route:routeInfo(state.search).label,lastCheck:state.lastCheck,trips:fresh});}
    catch {warnings.push("Telegram bildirimi sıraya alınamadı.");}
    if (warnings.length) { state.warning=warnings.join(" "); await save(state); }
  }
  if (state.enabled) await schedule(state);
}

export async function updateConfig(tabId,input) {
  const config=settings(input);
  // Takip kapalıyken de seçimi saklar; alan değiştirmek kendiliğinden takip başlatmaz.
  await chrome.storage.local.set({preferences:config});
  const state=await get();
  if(state.tabId!==tabId || !state.search)return {active:false,config};
  const timeChanged=state.config?.start!==config.start || state.config?.end!==config.end;
  const intervalChanged=state.config?.interval!==config.interval;
  state.config=config;
  if(timeChanged) {
    // Önceki filtrenin daraltılmış listesinden değil, son tam kontrolden yeniden süz.
    try {state.trips=state.lastSnapshot?evaluate(state.lastSnapshot,config,state.search):[];}
    catch {state.trips=[];}
    if(!state.enabled && ["idle","found"].includes(state.phase)) {
      state.phase="idle";
      state.message="Yeni saat aralığı kaydedildi. Takip kapalı; Başlat ile devam edebilirsiniz.";
    }
  }
  await save(state);
  if(state.enabled && state.phase==="waiting") {
    if(timeChanged) {
      await pageTimer(state,true);await chrome.alarms.clear(REFRESH);
      try {await reload(state);} catch(e) {await pause(state,e.message,false);}
    } else if(intervalChanged) {
      await pageTimer(state,true);await schedule(state);
    }
  }
  // Zaten yükleniyorsa aynı yenilemenin sonucuna yeni filtre uygulanır.
  return {active:(await get()).enabled,config};
}

export async function stop() {
  const state=await get();
  state.enabled=false; state.phase="idle"; state.nextCheck=null; state.message="Takip durduruldu.";
  await clearAlarms();
  await pageTimer(state,true);
  if (state.tabId) try { await call(state.tabId,clearResume); } catch {}
  await save(state);
  return state;
}

export async function alarm(name) {
  const state=await get();
  if (!state.enabled) return;
  if (name===DEADLINE && state.phase==="reloading") return pause(state,"Sayfa 70 saniyede okunamadı. Doğrulama veya bağlantıyı kontrol edip Başlat'a basın.");
  if (name===REFRESH && state.phase==="waiting" && Date.now()>=state.nextCheck) return reload(state);
}

export async function refreshDue(tabId,runId,dueAt) {
  const state=await get();
  if(!state.enabled || state.phase!=="waiting" || state.tabId!==tabId || state.runId!==runId ||
      state.nextCheck!==dueAt || Date.now()<dueAt)return;
  await reload(state);
}

async function pageReady(tabId) {
  const state=await get();
  if(state.enabled && state.tabId===tabId && state.phase==="waiting") await pageTimer(state);
  else await inspect(tabId);
}

export async function view(tabId) {
  let state=await get();
  const preferences=(await chrome.storage.local.get("preferences")).preferences;
  let preview;
  try {
    const tab=await chrome.tabs.get(tabId);
    if (!siteUrl(tab.url)) throw new Error("TCDD sefer listesini açın.");
    let snapshot=await probe(tabId);
    if (state.enabled && state.tabId===tabId && state.phase==="reloading" &&
        (snapshot.status==="challenge" || (snapshot.status==="ready" && snapshot.documentKey!==state.previousDocument))) {
      await inspect(tabId);
      state=await get();
      snapshot=await probe(tabId);
    }
    if (snapshot.status!=="ready") return {state,preferences,preview:{ok:false,message:snapshot.message,
      diagnostics:{version:chrome.runtime.getManifest().version,...snapshot.diagnostics}}};
    const search=sanitizeSearch(snapshot.search);
    const route=routeInfo(search);
    preview={ok:true, day:localSearchDate(search), from:route.from, to:route.to, label:route.label, matchesWatch:state.search?searchKey(search)===searchKey(state.search):false};
  } catch (e) { preview={ok:false,message:e.message}; }
  return {state,preview,preferences};
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (message.target==="audio" || sender.id!==chrome.runtime.id) return;
  const ui=sender.url===chrome.runtime.getURL("popup.html");
  let work,independent=false;
  if (message.type==="PAGE_READY" && sender.tab && siteUrl(sender.tab.url)) work=()=>pageReady(sender.tab.id);
  else if (message.type==="REFRESH_DUE" && sender.tab && siteUrl(sender.tab.url)) work=()=>refreshDue(sender.tab.id,message.runId,message.dueAt);
  else if (ui && message.type==="VIEW") work=()=>view(message.tabId);
  else if (ui && message.type==="START") work=()=>start(message.tabId,message.config);
  else if (ui && message.type==="UPDATE_CONFIG") work=()=>updateConfig(message.tabId,message.config);
  else if (ui && message.type==="STOP") work=stop;
  else if (ui && message.type==="TEST_ALERT") work=async()=>{
    await notification("TCDD — Deneme bildirimi","Yer bulunduğunda bu bildirim gösterilecek.",true);
    await sound(); return {tested:true};
  };
  else if(ui && message.type==="TELEGRAM_VIEW") {independent=true;work=telegramView;}
  else if(ui && message.type==="TELEGRAM_CONNECT") {independent=true;work=()=>connectTelegram(message.config);}
  else if(ui && message.type==="TELEGRAM_ENABLED") {independent=true;work=()=>setTelegramEnabled(message.enabled);}
  else if(ui && message.type==="TELEGRAM_DISCONNECT") {independent=true;work=disconnectTelegram;}
  else if(ui && message.type==="TELEGRAM_TEST") {independent=true;work=testTelegram;}
  if (!work) return;
  (independent?Promise.resolve().then(work):serial(work)).then(result=>respond({ok:true,result})).catch(e=>respond({ok:false,error:e.message}));
  return true;
});
chrome.alarms.onAlarm.addListener(a=>{
  if(a.name===TELEGRAM_ALARM) {void flushTelegram().catch(()=>{});return;}
  serial(()=>alarm(a.name)).catch(async e=>pause(await get(),e.message).catch(()=>{}));
});
chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if (change.status==="complete") serial(()=>inspect(tabId)).catch(async e=>pause(await get(),e.message).catch(()=>{}));
  if (change.url) serial(async()=>{
    const state=await get();
    if (!state.enabled || state.tabId!==tabId) return;
    if (!siteUrl(change.url) || !["/", "/sefer-listesi"].includes(new URL(change.url).pathname)) await pause(state,"Sefer listesinden ayrıldınız. Takip durdu.");
  }).catch(()=>{});
});
chrome.tabs.onRemoved.addListener(tabId=>serial(async()=>{
  const state=await get(); if (state.enabled && state.tabId===tabId) await pause(state,"Takip edilen sekme kapandı.",false);
}).catch(()=>{}));
chrome.notifications.onClicked.addListener(async id=>{
  if(id!=="tcdd-watch") return;
  const state=await get();
  try { const tab=await chrome.tabs.update(state.tabId,{active:true}); await chrome.windows.update(tab.windowId,{focused:true}); } catch {}
});
chrome.runtime.onStartup.addListener(()=>serial(async()=>{
  const state=await get();
  if(state.enabled) await pause(state,"Tarayıcı yeniden açıldı. Doğru seferde Başlat'a basın.",false);
  else if(state.tabId) { state.tabId=null;state.phase="idle";state.trips=[];state.message="Doğru seferde Başlat'a basın.";await save(state); }
}).catch(()=>{}));
// Servis çalışanı uyursa kaybolabilecek tek seferlik alarmı durumdan geri kur.
serial(async()=>{
  if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"});
  const state=await get();
  if(state.enabled && state.phase==="waiting" && !(await chrome.alarms.get(REFRESH))) await chrome.alarms.create(REFRESH,{when:Math.max(Date.now()+1000,state.nextCheck||Date.now()+1000)});
  if(state.enabled && state.phase==="waiting") await pageTimer(state);
  if(state.enabled && state.phase==="reloading" && !(await chrome.alarms.get(DEADLINE))) await chrome.alarms.create(DEADLINE,{when:Math.max(Date.now()+1000,(state.loadingSince||Date.now())+70000)});
}).catch(()=>{});
void flushTelegram().catch(()=>{});
