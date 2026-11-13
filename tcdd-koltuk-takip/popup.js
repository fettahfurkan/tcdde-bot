import {settings, routeInfo} from "./core.js";
import {initTelegram} from "./telegram-ui.js";
const $=id=>document.getElementById(id);
let tabId, initialized=false, pending=false, saving=false, dirty=false, lastSaved="";
const titles={idle:"Takip kapalı",waiting:"Takip açık",reloading:"Tarih değiştirilip yenileniyor",paused:"Müdahale gerekiyor",found:"Normal koltuk bulundu"};
const dateText=d=>d?d.split("-").reverse().join("."):"";
const clock=ms=>ms?new Date(ms).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"";
async function send(type,extra={}) {
  const reply=await chrome.runtime.sendMessage({type,tabId,...extra});
  if(!reply?.ok) throw new Error(reply?.error || "Eklentiye ulaşılamadı.");
  return reply.result;
}
function error(message="") {$("error").textContent=message;$("error").hidden=!message;}
function renderRoute(from,to) {
  if(!to) {
    $("routeTitle").textContent=from;
    return;
  }
  const sep=document.createElement("span");
  sep.className="route-sep";
  sep.textContent="/";
  $("routeTitle").replaceChildren(from,sep,to);
}
function readConfig() {return settings({interval:Number($("interval").value),start:$("start").value,end:$("end").value,sound:$("sound").checked,stopOnFound:$("stopOnFound").checked});}
async function applyChanges() {
  if(saving || pending || !tabId)return;
  let config;
  try {
    if(!$("start").value || !$("end").value)throw new Error("Kalkış saatlerini tamamlayın.");
    config=readConfig();
  } catch(e) {$("applyStatus").textContent=e.message;return;}
  const signature=JSON.stringify(config);
  if(signature===lastSaved) {dirty=false;$("applyStatus").textContent="Ayarlar güncel.";return;}
  saving=true;dirty=false;$("applyStatus").textContent="Ayarlar uygulanıyor…";error();
  try {
    const result=await send("UPDATE_CONFIG",{config});lastSaved=signature;
    $("applyStatus").textContent=result.active?"Ayarlar otomatik uygulandı.":"Ayarlar kaydedildi; Başlatınca kullanılacak.";
  } catch(e) {error(e.message);$("applyStatus").textContent="Ayarlar uygulanamadı.";}
  finally {saving=false;if(dirty)await applyChanges();else await refresh();}
}
function changed() {initialized=true;dirty=true;void applyChanges();}
async function refresh() {
  if(pending || saving || !tabId) return;
  try {
    const {state,preview,preferences}=await send("VIEW");
    if(pending || saving)return;
    const own=state.tabId===tabId && preview.matchesWatch!==false;
    if(preview.ok) renderRoute(preview.from,preview.to);
    else if(own && state.search?.searchRoutes?.[0]) {
      const r=routeInfo(state.search);
      renderRoute(r.from,r.to);
    } else renderRoute("Açık sefer yok");
    $("date").textContent=preview.ok?dateText(preview.day):own && state.day?dateText(state.day):"—";
    $("statusTitle").textContent=own?titles[state.phase] || "Takip kapalı":preview.ok?"Başlamaya hazır":"Sefer listesi bekleniyor";
    $("message").textContent=own?state.message:!preview.ok?preview.message:state.enabled?"Başlatırsanız takip bu sekmeye geçer.":"Açık sefer ve tarih izlenecek.";
    $("diagnosticsBox").hidden=preview.ok || !preview.diagnostics;
    $("diagnostics").value=preview.diagnostics?JSON.stringify(preview.diagnostics,null,2):"";
    const badgeState=own && state.phase==="found"?"found":own && state.phase==="paused"?"paused":own && state.enabled?"active":"idle";
    $("badge").dataset.state=badgeState;
    $("badge").textContent=badgeState==="found"?"Yer bulundu":badgeState==="paused"?"Duraklatıldı":badgeState==="active"?"Takip açık":"Hazır";
    $("dot").style.background=badgeState==="paused"?"#d97706":badgeState==="active" || badgeState==="found"?"#059669":"#9ca3af";
    const timingText=own?[state.config?`Saat: ${state.config.start}–${state.config.end}`:"",state.count?`${state.count}. kontrol`:"",state.lastCheck?`Son: ${clock(state.lastCheck)}`:"",state.nextCheck?`Sonraki: ${clock(state.nextCheck)}`:""].filter(Boolean).join(" · "):"";
    $("timing").textContent=timingText;
    $("timing").hidden=!timingText;
    $("startButton").disabled=!preview.ok || (own && state.enabled);
    $("startLabel").textContent=own && state.enabled?"Takip açık":"Başlat";
    $("stopButton").disabled=!state.enabled;
    if(!initialized) {
      const c=preferences || state.config;
      if(c) for(const key of ["interval","start","end","sound","stopOnFound"]) {
        if(typeof c[key]==="boolean") $(key).checked=c[key]; else $(key).value=c[key];
      }
      initialized=true;
      lastSaved=JSON.stringify(readConfig());
    }
    $("results").hidden=!own || !state.trips?.length;
    $("trips").replaceChildren();
    if(own) for(const t of state.trips || []) {
      const row=document.createElement("div");row.className="trip";
      const normalCls=t.normal>0?"counts has-seat":"counts";
      for(const [tag,text,cls] of [["b",t.time,""],["span",t.name,"train"],["span",`${t.normal} normal`,normalCls],["span",`${t.wheelchair} engelli`,"excluded"]]) {
        const el=document.createElement(tag);el.textContent=text;el.className=cls;row.append(el);
      }
      $("trips").append(row);
    }
    if(state.warning && own) error(state.warning);
  } catch(e) {error(e.message);}
}
async function action(work) {if(pending)return;pending=true;$("startButton").disabled=true;$("stopButton").disabled=true;error();try{while(saving)await new Promise(resolve=>setTimeout(resolve,10));await work();}catch(e){error(e.message);}finally{pending=false;if(dirty)await applyChanges();else await refresh();}}
$("form").addEventListener("submit",e=>{
  e.preventDefault();
  action(()=>send("START",{config:readConfig()}));
});
for(const id of ["interval","start","end","sound","stopOnFound"]) {
  $(id).addEventListener("input",changed);$(id).addEventListener("change",changed);
}
$("stopButton").addEventListener("click",()=>action(()=>send("STOP")));
$("test").addEventListener("click",()=>action(()=>send("TEST_ALERT")));
const tabs=await chrome.tabs.query({active:true,currentWindow:true});
tabId=tabs[0]?.id;
await refresh();
initTelegram(send);
if(dirty)await applyChanges();
setInterval(refresh,2500);
