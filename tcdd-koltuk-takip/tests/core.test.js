import test from "node:test";
import assert from "node:assert/strict";
import {settings,sanitizeSearch,routeInfo,searchKey,localSearchDate,departure,seatCounts,evaluate} from "../core.js";

export const search={searchRoutes:[{departureStationId:98,arrivalStationId:48,departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]};
const cabin=(code,count)=>({cabinClass:{id:code,code},availabilityCount:count});
export function fixture(normal=0,wheelchair=2,documentKey="first") {
  return {status:"ready",documentKey,search:structuredClone(search),trips:[{trains:[{id:1,name:"YHT 123",departureStationId:98,arrivalStationId:48,
    segments:[{departureTime:"15.11.99 09:00"}],availableFareInfo:[{cabinClasses:[cabin("Y1",normal),cabin("DSB",wheelchair)]}]}]}]};
}
const now=Date.parse("2099-11-15T00:00:00+03:00");
test("yalnızca DSB yeri müsait sayılmaz",()=>{
  const result=evaluate(fixture(),settings(),search,now);
  assert.equal(result[0].normal,0); assert.equal(result[0].wheelchair,2);
});
test("normal koltuk açıldığında yeni sayı okunur",()=>{
  assert.deepEqual([0,3,0].map(n=>evaluate(fixture(n),settings(),search,now)[0].normal),[0,3,0]);
});
test("standart ve esnek tarife aynı koltuğu iki kez saymaz",()=>{
  const train=fixture(3).trips[0].trains[0];
  train.availableFareInfo.push(structuredClone(train.availableFareInfo[0]));
  assert.deepEqual(seatCounts(train),{normal:3,wheelchair:2});
});
test("bilinmeyen sınıf veya belirsiz sayı hata verir",()=>{
  for(const c of [cabin("UNKNOWN",2),cabin("Y1",-1),cabin("Y1",null),cabin("Y1","3")]) {
    assert.throws(()=>seatCounts({availableFareInfo:[{cabinClasses:[c]}]}));
  }
});
test("tarih ve istasyon değişirse karar verilmez",()=>{
  for(const patch of [{departureDate:"15-11-2099 21:00:00"},{arrivalStationId:49}]) {
    const f=fixture();Object.assign(f.search.searchRoutes[0],patch);
    assert.throws(()=>evaluate(f,settings(),search,now));
  }
});
test("saat sınırları dahil, geçmiş seferler hariç",()=>{
  assert.equal(evaluate(fixture(),settings({start:"09:00",end:"09:00"}),search,now).length,1);
  assert.equal(evaluate(fixture(),settings({start:"09:01"}),search,now).length,0);
  assert.equal(evaluate(fixture(),settings(),search,Date.parse("2099-11-15T09:01:00+03:00")).length,0);
});
test("görüntü saati ve ham UTC aynı Türkiye saatine çevrilir",()=>{
  assert.equal(departure("15.11.99 09:00").ms,departure("2099-11-15T06:00:00Z").ms);
  assert.equal(departure("15.11.2099 09:00").ms,departure("2099-11-15T06:00:00").ms);
  assert.equal(localSearchDate(search),"2099-11-15");
});
test("sadece gerekli arama alanları saklanır",()=>{
  const clean=sanitizeSearch({...search,token:"private",user:{name:"private"}});
  assert.equal(clean.token,undefined); assert.equal(clean.user,undefined);
  assert.equal(searchKey(clean),searchKey(search));
});
test("ayarlar ve doğrulama hataları",()=>{
  assert.equal(settings({interval:1}).interval,1);assert.equal(settings({interval:5}).interval,5);
  for(const interval of [0,-1,0.5,NaN,Infinity])assert.throws(()=>settings({interval}));
  assert.throws(()=>settings({start:"20:00",end:"08:00"}));
  assert.throws(()=>evaluate({status:"challenge",message:"Doğrulama gerekli"},settings(),search,now),/Doğrulama/);
});
test("aktarmalı yolculuk normal koltuk sonucuna eklenmez",()=>{
  const f=fixture();f.trips[0].trains.push(structuredClone(f.trips[0].trains[0]));
  assert.deepEqual(evaluate(f,settings(),search,now),[]);
});
test("Pendik → Ankara Gar (48 → 98) ters yön araması da kabul edilir",()=>{
  const reverseSearch={searchRoutes:[{departureStationId:48,arrivalStationId:98,departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]};
  const clean=sanitizeSearch(reverseSearch);
  assert.equal(clean.searchRoutes[0].departureStationName,"İSTANBUL(PENDİK)");
  assert.equal(clean.searchRoutes[0].arrivalStationName,"ANKARA GAR");
  assert.deepEqual(routeInfo(clean),{from:"Pendik",to:"Ankara Gar",label:"İstanbul (Pendik) → Ankara Gar"});
  const revFixture=fixture(4,1);
  revFixture.search=structuredClone(reverseSearch);
  revFixture.trips[0].trains[0].departureStationId=48;
  revFixture.trips[0].trains[0].arrivalStationId=98;
  const result=evaluate(revFixture,settings(),reverseSearch,now);
  assert.equal(result.length,1);
  assert.equal(result[0].normal,4);
});
test("ekranda seçili herhangi bir tek yön güzergâh desteklenir",()=>{
  const anySearch={searchRoutes:[{departureStationId:132,arrivalStationId:245,departureStationName:"ESKİŞEHİR",arrivalStationName:"KONYA(SELÇUKLU)",departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]};
  const clean=sanitizeSearch(anySearch);
  assert.equal(clean.searchRoutes[0].departureStationName,"ESKİŞEHİR");
  assert.equal(clean.searchRoutes[0].arrivalStationName,"KONYA(SELÇUKLU)");
  assert.deepEqual(routeInfo(clean),{from:"Eskişehir",to:"Selçuklu",label:"Eskişehir → Konya (Selçuklu)"});
  const anyFixture=fixture(2,0);
  anyFixture.search=structuredClone(anySearch);
  anyFixture.trips[0].trains[0].departureStationId=132;
  anyFixture.trips[0].trains[0].arrivalStationId=245;
  const result=evaluate(anyFixture,settings(),anySearch,now);
  assert.equal(result.length,1);
  assert.equal(result[0].normal,2);
  assert.throws(()=>sanitizeSearch({searchRoutes:[{departureStationId:132,arrivalStationId:132,departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]}));
});
