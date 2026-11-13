import test from "node:test";
import assert from "node:assert/strict";

const search={searchRoutes:[{departureStationId:98,arrivalStationId:48,departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]};
function fixture(normal=0,wheelchair=2,documentKey="first") {
  return {status:"ready",documentKey,search:structuredClone(search),trips:[{trains:[{id:1,name:"YHT 123",departureStationId:98,arrivalStationId:48,
    segments:[{departureTime:"15.11.99 09:00"}],availableFareInfo:[{cabinClasses:[{cabinClass:{id:1,code:"Y1"},availabilityCount:normal},{cabinClass:{id:2,code:"DSB"},availabilityCount:wheelchair}]}]}]}]};
}
const event=()=>({addListener(){}});
let state, preferences, snapshot, reloads=0, cycleOk=false, notices=[], timers=[], alarms=new Map(), tabUrl="https://ebilet.tcddtasimacilik.gov.tr/sefer-listesi";
let clock=Date.parse("2026-11-10T00:00:00+03:00");
Date.now=()=>clock;
globalThis.chrome={
  storage:{local:{get:async()=>({watch:structuredClone(state),preferences:structuredClone(preferences)}),set:async value=>{
    if("watch" in value)state=structuredClone(value.watch);if("preferences" in value)preferences=structuredClone(value.preferences);
  }}},
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  alarms:{create:async(n,a)=>alarms.set(n,a),clear:async n=>alarms.delete(n),get:async n=>alarms.get(n),onAlarm:event()},
  scripting:{executeScript:async options=>[{result:options.func?.name==="readPage"?structuredClone(snapshot):options.func?.name==="cycleDateRefresh" && cycleOk?{ok:true}:undefined}]},
  tabs:{get:async()=>({id:7,url:tabUrl}),reload:async()=>{reloads++;},sendMessage:async(id,message)=>timers.push(message),onUpdated:event(),onRemoved:event()},
  notifications:{create:async(id,n)=>notices.push(n),onClicked:event()},
  runtime:{id:"test",getURL:p=>`chrome-extension://test/${p}`,onMessage:event(),onStartup:event(),getContexts:async()=>[{}],sendMessage:async()=>({ok:true})},
};
const {start,inspect,stop,alarm,serial,refreshDue,updateConfig,view}=await import("../background.js");
await serial(async()=>{});
function reset() {state=undefined;preferences=undefined;snapshot=fixture();reloads=0;cycleOk=false;notices=[];timers=[];alarms=new Map();tabUrl="https://ebilet.tcddtasimacilik.gov.tr/sefer-listesi";clock=Date.parse("2026-11-10T00:00:00+03:00");}
async function due() {clock=state.nextCheck || clock+1;return alarm("tcdd-refresh");}
test("başlatma gerçek yenileme yapar; eski belge okunmaz; DSB alarm oluşturmaz",async()=>{
  reset();await start(7,{sound:false});assert.equal(reloads,1);
  await inspect(7);assert.equal(state.lastCheck,undefined);assert.equal(notices.length,0);
  snapshot=fixture(0,2,"second");await inspect(7);
  assert.equal(state.enabled,true);assert.equal(state.trips[0].normal,0);assert.equal(notices.length,0);
  assert.ok(alarms.has("tcdd-refresh"));
  await due();assert.equal(reloads,2);
  snapshot=fixture(1,2,"third");await inspect(7);
  assert.equal(state.phase,"found");assert.equal(state.enabled,false);assert.equal(notices.length,1);
  await due();assert.equal(reloads,2);
});
test("doğrulama veya yükleme zaman aşımı tekrar yenilemez",async()=>{
  reset();await start(7,{sound:false});snapshot={status:"challenge",documentKey:"second",message:"Elle doğrulayın"};
  await inspect(7);assert.equal(state.phase,"paused");assert.equal(state.enabled,false);
  await due();assert.equal(reloads,1);
  reset();await start(7,{sound:false});await alarm("tcdd-load-deadline");
  assert.equal(state.phase,"paused");assert.equal(alarms.size,0);
});
test("durdur ve tarih değişimi yenilemeyi keser",async()=>{
  reset();await start(7,{sound:false});await stop();await due();assert.equal(reloads,1);
  reset();await start(7,{sound:false});snapshot=fixture(0,2,"second");await inspect(7);
  snapshot.search.searchRoutes[0].departureDate="15-11-2099 21:00:00";
  await due();assert.equal(reloads,1);assert.equal(state.phase,"paused");
});
test("koltuk seçimi/ödeme sayfası yenilenmez",async()=>{
  reset();await start(7,{sound:false});snapshot=fixture(0,2,"second");await inspect(7);
  tabUrl="https://ebilet.tcddtasimacilik.gov.tr/koltuk-haritasi";
  await due();assert.equal(reloads,1);assert.equal(state.enabled,false);
});
test("boş liste yer yok olarak kabul edilmez",async()=>{
  reset();await start(7,{sound:false});snapshot=fixture(0,2,"second");snapshot.trips=[];
  await inspect(7);assert.equal(state.phase,"paused");assert.equal(state.lastCheck,undefined);
});
test("takibe devam edilirse aynı müsaitlik tekrar tekrar bildirilmez",async()=>{
  reset();await start(7,{sound:false,stopOnFound:false});snapshot=fixture(2,2,"second");await inspect(7);
  assert.equal(notices.length,1);assert.equal(state.enabled,true);
  await due();snapshot=fixture(2,2,"third");await inspect(7);assert.equal(notices.length,1);
  await due();snapshot=fixture(0,2,"fourth");await inspect(7);
  await due();snapshot=fixture(1,2,"fifth");await inspect(7);assert.equal(notices.length,2);
});

test("1 saniye zamanlayıcı ve alarm aynı anda gelse de tek yenileme yapılır",async()=>{
  reset();await start(7,{sound:false,interval:1});snapshot=fixture(0,2,"second");await inspect(7);
  assert.equal(state.nextCheck-clock,1000);
  assert.equal(timers.at(-1).type,"SCHEDULE_REFRESH");
  const {runId,nextCheck}=state;
  await refreshDue(7,runId,nextCheck);assert.equal(reloads,1);
  clock=nextCheck;
  await refreshDue(7,"eski-run",nextCheck);assert.equal(reloads,1);
  await refreshDue(7,runId,nextCheck);assert.equal(reloads,2);
  await due();assert.equal(reloads,2);
  await refreshDue(7,runId,nextCheck);assert.equal(reloads,2);
  await stop();assert.equal(timers.at(-1).type,"CANCEL_REFRESH");
});

test("seçilen kalkış saati dışındaki müsait koltuk bildirilmez",async()=>{
  reset();await start(7,{sound:false,interval:5,start:"10:00",end:"12:30"});
  snapshot=fixture(9,2,"second");await inspect(7);
  assert.equal(state.enabled,true);assert.deepEqual(state.trips,[]);assert.equal(notices.length,0);
  await due();snapshot=fixture(2,2,"third");snapshot.trips[0].trains[0].segments[0].departureTime="15.11.99 12:30";
  await inspect(7);assert.equal(state.phase,"found");assert.equal(notices.length,1);
});

test("takip ayarları güncellendiğinde eski zamanlayıcı yeni takibi tetiklemez",async()=>{
  reset();await start(7,{sound:false,interval:10});snapshot=fixture(0,2,"second");await inspect(7);
  const oldRun=state.runId,oldDue=state.nextCheck;
  await start(7,{sound:false,interval:2,start:"10:00",end:"12:30"});
  assert.equal(state.config.interval,2);assert.equal(state.config.start,"10:00");assert.notEqual(state.runId,oldRun);
  clock=oldDue;await refreshDue(7,oldRun,oldDue);assert.equal(reloads,2);
  snapshot=fixture(1,2,"third");snapshot.trips[0].trains[0].segments[0].departureTime="15.11.99 11:00";
  await inspect(7);assert.equal(state.phase,"found");assert.equal(state.trips[0].time,"11:00");
});

test("saat değişimi otomatik uygulanır, mevcut satırlar süzülür ve yeni kontrol başlar",async()=>{
  reset();await start(7,{sound:false,interval:10});snapshot=fixture(0,2,"second");await inspect(7);
  const runId=state.runId;
  await updateConfig(7,{...state.config,start:"10:00",end:"12:30"});
  assert.equal(state.runId,runId);assert.equal(reloads,2);assert.equal(state.phase,"reloading");assert.deepEqual(state.trips,[]);
  assert.equal(preferences.start,"10:00");assert.equal(notices.length,0);
  snapshot=fixture(2,2,"third");snapshot.trips[0].trains[0].segments[0].departureTime="15.11.99 11:00";
  await inspect(7);assert.equal(state.phase,"found");assert.equal(state.trips[0].time,"11:00");
});

test("yükleme sırasında saat değişimi ikinci yenileme başlatmaz",async()=>{
  reset();await start(7,{sound:false});
  await updateConfig(7,{...state.config,start:"10:00",end:"12:30"});
  assert.equal(reloads,1);assert.equal(state.phase,"reloading");
  snapshot=fixture(8,2,"second");await inspect(7);
  assert.deepEqual(state.trips,[]);assert.equal(notices.length,0);assert.equal(state.enabled,true);
});

test("saniye değişimi otomatik olarak beklemeyi yeniden ayarlar",async()=>{
  reset();await start(7,{sound:false,interval:60});snapshot=fixture(0,2,"second");await inspect(7);
  const oldDue=state.nextCheck;
  await updateConfig(7,{...state.config,interval:3});
  assert.equal(state.nextCheck-clock,3000);assert.equal(reloads,1);assert.equal(preferences.interval,3);
  await refreshDue(7,state.runId,oldDue);assert.equal(reloads,1);
});

test("başlatmadan ayarlar saklanır; geçersiz saat eski ayarları bozmaz",async()=>{
  reset();await updateConfig(7,{interval:5,start:"08:00",end:"18:00"});
  assert.equal(preferences.interval,5);assert.equal(state,undefined);assert.equal(reloads,0);
  await assert.rejects(()=>updateConfig(7,{interval:2,start:"20:00",end:"10:00"}));
  assert.equal(preferences.interval,5);
});

test("durdurulmuş takip, saat değiştirince kendiliğinden başlamaz",async()=>{
  reset();await start(7,{sound:false});snapshot=fixture(2,2,"second");await inspect(7);
  assert.equal(state.phase,"found");
  await updateConfig(7,{...state.config,start:"10:00",end:"12:30"});
  assert.equal(state.enabled,false);assert.equal(state.phase,"idle");assert.deepEqual(state.trips,[]);assert.equal(reloads,1);
});

test("tarih geçişi destekleniyorsa sekme yenilenmez ve sonuç otomatik okunur",async()=>{
  reset();cycleOk=true;
  await start(7,{sound:false});
  assert.equal(reloads,0);
  assert.equal(state.phase,"reloading");
  snapshot=fixture(2,2,"cycled-1");
  await new Promise(r=>setTimeout(r,380));
  await serial(async()=>{});
  assert.equal(state.phase,"found");
  assert.equal(state.trips[0].normal,2);
  assert.equal(reloads,0);
});
