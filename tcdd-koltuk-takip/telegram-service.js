import {telegramApi,parseTelegramFile,normalizeChatId,privateChats,seatMessage} from "./telegram-api.js";
export const TELEGRAM_ALARM="tcdd-telegram-retry";
let transactions=Promise.resolve(),sending=null;
function transaction(work) {const result=transactions.then(work);transactions=result.catch(()=>{});return result;}
const config=async()=> (await chrome.storage.local.get("telegram")).telegram || {};
export async function telegramView() {
  const c=await config();
  return {enabled:!!(c.enabled && c.botToken && c.chatId),hasToken:!!c.botToken,chatId:c.chatId || "",botUsername:c.botUsername || "",
    chats:Array.isArray(c.chats)?c.chats.map(chat=>({id:chat.id,label:chat.label})):[],
    lastSentAt:c.lastSentAt || null,lastError:c.lastError || ""};
}
export async function connectTelegram(input={}) {
  const old=await config();
  const botToken=input.botToken?parseTelegramFile(input.botToken).botToken:old.botToken;
  if(!botToken)throw new Error("BotFather anahtarını girin veya anahtar dosyasını seçin.");
  const bot=await telegramApi(botToken,"getMe");
  let chatId=input.chatId?normalizeChatId(input.chatId):(botToken===old.botToken?old.chatId:"");
  let chats=[];
  if(!chatId) {
    chats=privateChats(await telegramApi(botToken,"getUpdates",{timeout:0,limit:100,allowed_updates:["message"]}));
    if(!chats.length && botToken===old.botToken && Array.isArray(old.chats))chats=old.chats;
  }
  await transaction(async()=>{
    const changed=old.botToken!==botToken || old.chatId!==chatId;
    await chrome.storage.local.set({telegram:{botToken,botUsername:bot.username || "",chatId:chatId || "",chats,
      enabled:!!chatId,lastSentAt:changed?null:old.lastSentAt || null,lastError:""}});
    if(changed)await chrome.storage.local.remove("telegramPending");
  });
  return {...await telegramView(),chats};
}
export async function setTelegramEnabled(enabled) {
  await transaction(async()=>{
    const c=await config();
    if(enabled && (!c.botToken || !c.chatId))throw new Error("Önce botu ve hedef sohbeti bağlayın.");
    await chrome.storage.local.set({telegram:{...c,enabled:!!enabled,lastError:""}});
    if(!enabled) {await chrome.storage.local.remove("telegramPending");await chrome.alarms.clear(TELEGRAM_ALARM);}
  });
  return telegramView();
}
export async function disconnectTelegram() {
  await transaction(async()=>{await chrome.storage.local.remove(["telegram","telegramPending"]);await chrome.alarms.clear(TELEGRAM_ALARM);});
  return telegramView();
}
export async function testTelegram() {
  const c=await config();
  if(!c.botToken || !c.chatId)throw new Error("Önce Telegram botunu ve sohbeti bağlayın.");
  await telegramApi(c.botToken,"sendMessage",{chat_id:c.chatId,
    text:"TCDD Koltuk Takip bağlantı testi: Telegram bildirimi hazır. Bu mesaj boş koltuk bulunduğu anlamına gelmez.",
    link_preview_options:{is_disabled:true}});
  await transaction(async()=>{
    const latest=await config();
    if(latest.botToken===c.botToken && latest.chatId===c.chatId)await chrome.storage.local.set({telegram:{...latest,lastSentAt:Date.now(),lastError:""}});
  });
  return telegramView();
}
export async function queueSeatAlert(data) {
  const text=seatMessage(data);
  if(!text)return false;
  const queued=await transaction(async()=>{
    const c=await config();
    if(!c.enabled || !c.botToken || !c.chatId) {
      if(c.botToken)await chrome.storage.local.set({telegram:{...c,lastError:!c.chatId?
        "Koltuk bulundu; hedef sohbet seçilmediği için Telegram'a gönderilmedi.":
        "Koltuk bulundu; Telegram bildirimi kapalı olduğu için gönderilmedi."}});
      return false;
    }
    // Yeni koltuk bilgisi bekleyen eski bilgiyi yeniler; gecikmiş bir mesaj yığını oluşturulmaz.
    await chrome.storage.local.set({telegramPending:{id:crypto.randomUUID(),botId:c.botToken.split(":")[0],chatId:c.chatId,
      text,createdAt:Date.now(),nextAttemptAt:Date.now(),attempts:0}});
    await chrome.alarms.create(TELEGRAM_ALARM,{when:Date.now()+1000});return true;
  });
  if(queued)void flushTelegram().catch(()=>{});
  return queued;
}
export function flushTelegram() {
  if(!sending)sending=drain().finally(()=>{sending=null;});
  return sending;
}
async function drain() {
  for(let cycle=0;cycle<3;cycle++) {
    const p=(await chrome.storage.local.get("telegramPending")).telegramPending;
    if(!p)return;
    const c=await config();
    if(!c.enabled || !c.botToken || c.chatId!==p.chatId || c.botToken.split(":")[0]!==p.botId) {
      await finish(p,null,true);continue;
    }
    if(Date.now()-p.createdAt>180000) {await finish(p,"Telegram mesajı geciktiği için gönderilmedi. Güncel koltuk sonucunu kontrol edin.",true);continue;}
    if(p.nextAttemptAt>Date.now()) {await chrome.alarms.create(TELEGRAM_ALARM,{when:p.nextAttemptAt});return;}
    try {
      await telegramApi(c.botToken,"sendMessage",{chat_id:p.chatId,text:p.text,link_preview_options:{is_disabled:true}});
      await finish(p,null,true,true);
    } catch(e) {
      const retry=e.retryable && p.attempts<2;
      await finish(p,e.message,!retry,false,retry?Math.max(e.retryAfter*1000,15000*(p.attempts+1)):0);
      if(retry)return;
    }
  }
  const p=(await chrome.storage.local.get("telegramPending")).telegramPending;
  if(p)await chrome.alarms.create(TELEGRAM_ALARM,{when:Math.max(Date.now()+1000,p.nextAttemptAt)});
}
async function finish(p,error,remove,sent=false,delay=0) {
  await transaction(async()=>{
    const latest=(await chrome.storage.local.get("telegramPending")).telegramPending;
    if(latest?.id!==p.id)return;
    const c=await config();
    if(c.chatId===p.chatId && c.botToken?.split(":")[0]===p.botId)await chrome.storage.local.set({telegram:{...c,
      lastError:error || "",lastSentAt:sent?Date.now():c.lastSentAt || null}});
    if(remove)await chrome.storage.local.remove("telegramPending");
    else {
      const nextAttemptAt=Date.now()+delay;
      await chrome.storage.local.set({telegramPending:{...p,attempts:p.attempts+1,nextAttemptAt}});
      await chrome.alarms.create(TELEGRAM_ALARM,{when:nextAttemptAt});
    }
  });
}
