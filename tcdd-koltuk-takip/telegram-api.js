const TOKEN=/(?<![A-Za-z0-9_-])\d{6,12}:[A-Za-z0-9_-]{25,}(?![A-Za-z0-9_-])/g;
export class TelegramError extends Error {
  constructor(message,{retryable=false,retryAfter=0}={}) {super(message);this.retryable=retryable;this.retryAfter=retryAfter;}
}
export function parseTelegramFile(text) {
  let json;
  try {json=JSON.parse(text);} catch {}
  const tokens=[...new Set(String(json?.botToken || text).match(TOKEN) || [])];
  if(tokens.length!==1)throw new Error("Dosyada tek bir geçerli BotFather anahtarı bulunmalı.");
  const chatId=json?.chatId ?? text.match(/(?:chat[_ -]?id|sohbet[_ -]?id)\s*[:=]\s*(-?\d+)/i)?.[1] ?? "";
  return {botToken:tokens[0],chatId:chatId?normalizeChatId(chatId):""};
}
export function normalizeChatId(value) {
  const result=String(value ?? "").trim();
  if(!/^-?\d{1,20}$/.test(result) || result==="0")throw new Error("Geçerli bir Telegram sohbet ID'si girin.");
  return result;
}
export async function telegramApi(token,method,payload={},fetcher=globalThis.fetch) {
  if(!/^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(token || ""))throw new TelegramError("Bot anahtarı geçersiz.");
  if(!["getMe","getUpdates","sendMessage"].includes(method))throw new Error("Telegram yöntemi desteklenmiyor.");
  let response,data;
  try {
    response=await fetcher(`https://api.telegram.org/bot${token}/${method}`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
      credentials:"omit",redirect:"error",referrerPolicy:"no-referrer",cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    data=await response.json();
  } catch {throw new TelegramError("Telegram'a ulaşılamadı. Bağlantıyı kontrol edin.",{retryable:true});}
  if(!response.ok || !data?.ok) {
    const code=data?.error_code || response.status;
    if(code===401)throw new TelegramError("Bot anahtarı Telegram tarafından reddedildi.");
    if(code===403)throw new TelegramError("Bot bu sohbete yazamıyor. Botun engelini kaldırıp /start gönderin.");
    if(code===409)throw new TelegramError("Bot başka bir bağlantı veya webhook kullanıyor. Sohbet ID'sini elle girin.");
    if(code===429)throw new TelegramError("Telegram gönderim sınırına ulaşıldı; yeniden denenecek.",{retryable:true,retryAfter:Number(data?.parameters?.retry_after)||30});
    if(code>=500)throw new TelegramError("Telegram geçici olarak yanıt veremiyor.",{retryable:true});
    throw new TelegramError("Telegram isteği reddedildi. Sohbet ID'sini ve botun mesaj iznini kontrol edin.");
  }
  return data.result;
}
export function privateChats(updates) {
  const chats=new Map();
  for(const update of Array.isArray(updates)?updates:[]) {
    const message=update?.message,chat=message?.chat;
    if(chat?.type!=="private" || chat.id==null || message?.from?.is_bot)continue;
    chats.set(String(chat.id),{id:String(chat.id),label:String(chat.username?`@${chat.username}`:chat.first_name || "Özel sohbet").slice(0,80)});
  }
  return [...chats.values()];
}
export function seatMessage({day,route,lastCheck,trips}) {
  const available=(trips || []).filter(t=>Number.isInteger(t.normal) && t.normal>0);
  if(!available.length)return "";
  const date=String(day).split("-").reverse().join(".");
  const checked=new Date(lastCheck).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"});
  const rows=available.slice(0,12).map(t=>`${String(t.time).slice(0,5)} · ${String(t.name).slice(0,70)}: ${t.normal} normal koltuk`);
  return ["TCDD — Normal koltuk bulundu",route || "TCDD Sefer Bildirimi",`Tarih: ${date}`,"",...rows,"",
    `Kontrol: ${checked} (Türkiye saati)`,"Tekerlekli sandalye yerleri sayılmadı.","Müsaitlik değişebilir; koltuk tutulmaz.","https://ebilet.tcddtasimacilik.gov.tr/"].join("\n").slice(0,4000);
}
