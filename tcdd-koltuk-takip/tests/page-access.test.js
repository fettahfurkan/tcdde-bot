import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {readPage, cycleDateRefresh} from "../probe.js";

const code=readFileSync(new URL("../page-access.js",import.meta.url),"utf8");
function setup(elements, app=null) {
  const body={innerText:"Ankara Gar Pendik Sefer Listesi"};
  const document={body,readyState:"complete",querySelector:s=>s==="#app"?app:null,
    querySelectorAll:s=>s==="*"?elements:s.includes("data-v-app")?elements.filter(e=>e.__vue_app__):[]};
  const events=[];
  const window={dispatchEvent:e=>events.push(e.type)};
  const context=vm.createContext({document,window,CustomEvent:class{constructor(t){this.type=t;}},setTimeout,clearTimeout,Date,Promise,JSON,
    location:{pathname:"/sefer-listesi"},performance:{timeOrigin:1,now:()=>10000}});
  vm.runInContext(code,context);
  return {context,events,find:()=>vm.runInContext("__tcddSeatWatchAccess.find()",context),
    read:()=>vm.runInContext(`(${readPage.toString()})()`,context),
    cycle:(search,id)=>vm.runInContext(`(${cycleDateRefresh.toString()})(${JSON.stringify(search)}, ${JSON.stringify(id)})`,context)};
}
function store() {return {getters:{getSeferSearchInformation:{searchRoutes:[{departureStationId:98,arrivalStationId:48,departureDate:"14-11-2099 21:00:00"}],passengerTypeCounts:[{id:0,count:1}]}}};}
const data=()=>({departureTrainList:[],loadingSearch:false});
test("Vue 2 kökü #app dışında olsa da listeyi bulur",()=>{
  const s=store(),list=data(),root={$store:s,$children:[list]};
  const h=setup([{__vue__:root}],{});
  assert.equal(h.find().store,s);assert.equal(h.find().listData,list);assert.equal(h.read().status,"ready");
});
test("yalnızca alt bileşende Vue kaydı olsa da üst uygulamayı bulur",()=>{
  const s=store(),root={$store:s,$children:[]},list={...data(),$parent:root};root.$children=[list];
  const h=setup([{__vue__:list}]);
  assert.equal(h.find().store,s);assert.equal(h.read().status,"ready");
});
test("Vue 3 üretim yapısında _instance olmadan vnode üzerinden okur",()=>{
  const s=store(),list=data(),router={replace(){}};
  const component={proxy:{$data:list},subTree:{children:[]}};
  const rootInstance={proxy:{},subTree:{children:[{component}]}};
  const el={_vnode:{component:rootInstance}};
  el.__vue_app__={config:{globalProperties:{$store:s,$router:router}},_container:el};
  const h=setup([el],el);
  assert.equal(h.find().store,s);assert.equal(h.find().router,router);assert.equal(h.find().listData,list);
  assert.equal(h.read().status,"ready");
});
test("arayüz erişilemezse sonsuza kadar yükleniyor demez",()=>{
  const h=setup([{},{}]);
  const snapshot=h.read();assert.equal(snapshot.status,"unsupported");assert.equal(snapshot.diagnostics.hasStore,false);
  assert.match(snapshot.message,/okunamadı/);
});
test("güvenlik doğrulaması görünüyorsa eski liste kullanılmaz",()=>{
  const s=store(),h=setup([{__vue__:{$store:s,$children:[data()]}}]);
  h.context.document.body.innerText="Güvenlik Doğrulaması";
  assert.equal(h.read().status,"challenge");
});
test("sayfa yenilemeden bir sonraki tarihe geçip tekrar eski tarihe dönerek seferleri yeniler",async()=>{
  const s=store(),searchedDates=[];
  let slickGoToCalls=0;
  s.commit=(name,val)=>{if(name==="setSeferSearchInformation")s.getters.getSeferSearchInformation=val;};
  const list={
    ...data(),
    $refs:{slick1:{goTo(){slickGoToCalls++;}}},
    sliderGidisDates:[new Date(2099,10,15),new Date(2099,10,16)],
    fetchSeferList(payload) {
      this.loadingSearch=true;
      searchedDates.push(payload.searchRoutes[0].departureDate);
      return new Promise(r=>setTimeout(()=>{this.loadingSearch=false;r();},10));
    }
  };
  const h=setup([{__vue__:{$store:s,$children:[list]}}]);
  const initialKey=h.read().documentKey;
  const expected=s.getters.getSeferSearchInformation;
  const res=h.cycle(expected,"cycle-1");
  assert.equal(res.ok,true);
  assert.equal(h.read().status,"loading");
  await new Promise(r=>setTimeout(r,300));
  assert.equal(slickGoToCalls,0);
  assert.deepEqual(searchedDates,["15-11-2099 21:00:00","14-11-2099 21:00:00"]);
  const after=h.read();
  assert.equal(after.status,"ready");
  assert.notEqual(after.documentKey,initialKey);
  assert.equal(after.search.searchRoutes[0].departureDate,"14-11-2099 21:00:00");
  assert.ok(h.events.includes("tcdd-watch-ready"));
});
