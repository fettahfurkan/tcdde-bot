// Yalnızca yeni belge yüklenirken veya tarih geçişi tamamlandığında servis çalışanını uyandırır.
if (!globalThis.__tcddSeatWatchPageReady) {
  globalThis.__tcddSeatWatchPageReady = true;
  for (const delay of [0, 1500, 3500, 7000, 12000, 20000, 35000, 55000]) {
    setTimeout(() => chrome.runtime.sendMessage({type:"PAGE_READY"}).catch(()=>{}), delay);
  }
  window.addEventListener("tcdd-watch-ready", () => {
    for (const delay of [0, 300, 1000]) {
      setTimeout(() => chrome.runtime.sendMessage({type:"PAGE_READY"}).catch(()=>{}), delay);
    }
  });

  // Kısa aralıkları sekmede tutar; servis çalışanının uyumasına bağlı değildir.
  let timer=null, scheduled=null;
  function cancel() {clearTimeout(timer);timer=null;scheduled=null;}
  function tick() {
    if(!scheduled)return;
    const remaining=scheduled.dueAt-Date.now();
    if(remaining>0) {timer=setTimeout(tick,Math.min(remaining,2147483647));return;}
    const due=scheduled;cancel();
    chrome.runtime.sendMessage({type:"REFRESH_DUE",runId:due.runId,dueAt:due.dueAt}).catch(()=>{});
  }
  chrome.runtime.onMessage.addListener((message,sender)=>{
    if(sender.id!==chrome.runtime.id)return;
    if(message.type==="SCHEDULE_REFRESH" && typeof message.runId==="string" && Number.isFinite(message.dueAt)) {
      cancel();scheduled={runId:message.runId,dueAt:message.dueAt};tick();
    } else if(message.type==="CANCEL_REFRESH" && scheduled?.runId===message.runId)cancel();
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible" && scheduled){clearTimeout(timer);tick();}});
}
