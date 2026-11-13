import test from "node:test";
import assert from "node:assert/strict";
import {parseTelegramFile,normalizeChatId,privateChats,telegramApi,seatMessage} from "../telegram-api.js";

const token="123456789:TEST_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";
test("TXT ve JSON anahtar dosyası güvenle ayrıştırılır",()=>{
  assert.equal(parseTelegramFile(`Bot anahtarı: ${token}\n`).botToken,token);
  assert.deepEqual(parseTelegramFile(JSON.stringify({botToken:token,chatId:"12345"})),{botToken:token,chatId:"12345"});
  assert.throws(()=>parseTelegramFile("anahtar yok"));
  assert.throws(()=>parseTelegramFile(`${token}\n987654321:TEST_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`));
  assert.equal(normalizeChatId("-100123456789"),"-100123456789");
});
test("gruplar ve bot mesajları otomatik hedef seçilmez",()=>{
  const result=privateChats([{message:{chat:{id:1,type:"private",username:"owner"},from:{is_bot:false}}},
    {message:{chat:{id:2,type:"group"}}},{message:{chat:{id:3,type:"private"},from:{is_bot:true}}}]);
  assert.deepEqual(result,[{id:"1",label:"@owner"}]);
});
test("mesaj yalnızca normal koltukları ve kontrol zamanını içerir",()=>{
  const data={day:"2026-11-15",lastCheck:Date.parse("2026-11-10T10:00:00+03:00"),trips:[
    {time:"09:00",name:"YHT",normal:2,wheelchair:4},{time:"11:00",name:"YHT",normal:0,wheelchair:2}]};
  const message=seatMessage(data);
  assert.match(message,/15\.11\.2026/);assert.match(message,/09:00.*2 normal koltuk/);
  assert.doesNotMatch(message,/11:00/);assert.ok(message.length<=4096);
  assert.equal(seatMessage({...data,trips:[data.trips[1]]}),"");
});
test("API doğru Telegram hedefine gider; hata metnine anahtar sızmaz",async()=>{
  let call;
  await telegramApi(token,"sendMessage",{chat_id:"1",text:"test"},async(url,options)=>{
    call={url,options};return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};
  });
  assert.equal(new URL(call.url).hostname,"api.telegram.org");assert.equal(call.options.redirect,"error");
  assert.equal(JSON.parse(call.options.body).chat_id,"1");
  await assert.rejects(()=>telegramApi(token,"getMe",{},async()=>{throw new Error(`url ${token}`);}),e=>!e.message.includes(token) && e.retryable);
  await assert.rejects(()=>telegramApi(token,"getMe",{},async()=>({ok:false,status:401,json:async()=>({ok:false,error_code:401,description:token})})),e=>!e.message.includes(token) && !e.retryable);
});
test("Telegram hız sınırının yeniden deneme süresi korunur",async()=>{
  await assert.rejects(()=>telegramApi(token,"sendMessage",{},async()=>({ok:false,status:429,json:async()=>({ok:false,error_code:429,parameters:{retry_after:40}})})),e=>e.retryable && e.retryAfter===40);
});
