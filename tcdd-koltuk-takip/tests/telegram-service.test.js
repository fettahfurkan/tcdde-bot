import test from "node:test";
import assert from "node:assert/strict";

const token="123456789:TEST_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let data={},requests=[],alarms=new Map(),clock=Date.parse("2026-11-10T10:00:00+03:00"),fetcher;
Date.now=()=>clock;
globalThis.chrome={storage:{local:{
  get:async()=>structuredClone(data),set:async values=>Object.assign(data,structuredClone(values)),
  remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}
}},alarms:{create:async(name,value)=>alarms.set(name,value),clear:async name=>alarms.delete(name)}};
globalThis.fetch=async(url,options)=>{requests.push({method:url.split("/").at(-1),body:JSON.parse(options.body)});return fetcher(url,options);};
const {queueSeatAlert,flushTelegram,telegramView,connectTelegram,setTelegramEnabled,TELEGRAM_ALARM}=await import("../telegram-service.js");
const reply=result=>({ok:true,json:async()=>({ok:true,result})});
const alert=()=>({day:"2026-11-15",lastCheck:clock,trips:[{time:"09:00",name:"YHT",normal:2,wheelchair:2}]});
function reset(enabled=true) {
  data={telegram:{botToken:token,chatId:"12345",botUsername:"test_bot",enabled}};
  requests=[];alarms=new Map();clock=Date.parse("2026-11-10T10:00:00+03:00");fetcher=async()=>reply({message_id:1});
}
test("normal koltuk mesajı bir kez gönderilir, anahtar arayüze verilmez",async()=>{
  reset();await queueSeatAlert(alert());await flushTelegram();
  assert.equal(requests.length,1);assert.equal(requests[0].method,"sendMessage");assert.equal(requests[0].body.chat_id,"12345");
  assert.equal(data.telegramPending,undefined);assert.ok(data.telegram.lastSentAt);
  assert.ok(!JSON.stringify(await telegramView()).includes(token));
});
test("kapalı Telegram veya sadece DSB yeri mesaj üretmez",async()=>{
  reset(false);assert.equal(await queueSeatAlert(alert()),false);assert.equal(requests.length,0);
  reset();const onlyDisabled=alert();onlyDisabled.trips[0].normal=0;
  assert.equal(await queueSeatAlert(onlyDisabled),false);assert.equal(requests.length,0);
});
test("geçici ağ hatası masaüstü takibini engellemeden sırada bekler ve yeniden denenir",async()=>{
  reset();fetcher=async()=>{throw new Error("network");};
  await queueSeatAlert(alert());await flushTelegram();
  assert.equal(data.telegramPending.attempts,1);assert.ok(alarms.has(TELEGRAM_ALARM));
  assert.equal(data.telegram.lastSentAt,null);
  clock=data.telegramPending.nextAttemptAt;fetcher=async()=>reply({message_id:2});await flushTelegram();
  assert.equal(requests.length,2);assert.equal(data.telegramPending,undefined);assert.ok(data.telegram.lastSentAt);
});
test("geçersiz bot anahtarı sonsuz gönderim döngüsü oluşturmaz",async()=>{
  reset();fetcher=async()=>({ok:false,status:401,json:async()=>({ok:false,error_code:401})});
  await queueSeatAlert(alert());await flushTelegram();await flushTelegram();
  assert.equal(requests.length,1);assert.equal(data.telegramPending,undefined);assert.match(data.telegram.lastError,/anahtarı/);
});
test("hedef sohbet değiştirilince eski hedefin bekleyen mesajı aktarılmaz",async()=>{
  reset();fetcher=async()=>{throw new Error("network");};await queueSeatAlert(alert());await flushTelegram();
  fetcher=async()=>reply({username:"test_bot"});await connectTelegram({chatId:"67890"});
  assert.equal(data.telegramPending,undefined);assert.equal(data.telegram.chatId,"67890");
  const count=requests.length;clock+=20000;await flushTelegram();assert.equal(requests.length,count);
});
test("Telegram kapatılınca bekleyen bildirim silinir",async()=>{
  reset();fetcher=async()=>{throw new Error("network");};await queueSeatAlert(alert());await flushTelegram();
  await setTelegramEnabled(false);assert.equal(data.telegramPending,undefined);assert.equal(data.telegram.enabled,false);
});
test("gecikmiş koltuk mesajı güncelmiş gibi gönderilmez",async()=>{
  reset();fetcher=async()=>{throw new Error("network");};await queueSeatAlert(alert());await flushTelegram();
  clock+=181000;fetcher=async()=>reply({message_id:2});await flushTelegram();
  assert.equal(requests.length,1);assert.equal(data.telegramPending,undefined);assert.match(data.telegram.lastError,/geciktiği/);
});
test("tek sohbet bulunsa bile kullanıcı hedef seçmeden bildirim açılmaz",async()=>{
  reset();data={};
  fetcher=async url=>url.endsWith('/getMe')?reply({username:"test_bot"}):reply([
    {message:{chat:{id:12345,type:"private",first_name:"Owner"},from:{id:12345,is_bot:false}}}
  ]);
  const result=await connectTelegram({botToken:token});
  assert.equal(result.enabled,false);assert.equal(result.chatId,"");assert.equal(result.chats.length,1);
  assert.equal(await queueSeatAlert(alert()),false);assert.equal(requests.filter(r=>r.method==='sendMessage').length,0);
});
test("bulunan sohbetler popup yeniden açılınca korunur, anahtar arayüze sızmaz",async()=>{
  reset();data={};
  fetcher=async url=>url.endsWith('/getMe')?reply({username:"test_bot"}):reply([
    {message:{chat:{id:12345,type:"private",first_name:"Owner"},from:{id:12345,is_bot:false}}}
  ]);
  await connectTelegram({botToken:token});
  const reopened=await telegramView();
  assert.equal(reopened.enabled,false);assert.equal(reopened.chats[0].id,"12345");assert.ok(!JSON.stringify(reopened).includes(token));
  fetcher=async url=>url.endsWith('/getMe')?reply({username:"test_bot"}):reply([]);
  const reconnect=await connectTelegram({});assert.equal(reconnect.chats.length,1);
});
test("hedef eksikken veya bildirim kapalıyken gönderilmeme nedeni kaydedilir",async()=>{
  reset();data.telegram.chatId="";await queueSeatAlert(alert());
  assert.match(data.telegram.lastError,/hedef sohbet seçilmediği/);assert.equal(requests.length,0);
  reset(false);await queueSeatAlert(alert());assert.match(data.telegram.lastError,/bildirimi kapalı/);
  await setTelegramEnabled(true);assert.equal(data.telegram.lastError,"");
});
