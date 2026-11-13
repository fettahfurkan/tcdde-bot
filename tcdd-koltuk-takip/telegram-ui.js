import {parseTelegramFile} from "./telegram-api.js";

export function initTelegram(send) {
  const $=id=>document.getElementById(id);
  let busy=false,dirty=false,view={},lastChoices="";
  function render(data) {
    view=data;
    $("telegramEnabled").checked=!!data.enabled;
    $("telegramEnabled").disabled=busy || !data.hasToken || !data.chatId;
    $("tgTest").disabled=busy || !data.hasToken || !data.chatId;
    $("tgRemove").disabled=busy || !data.hasToken;
    $("tgSummary").textContent=!data.hasToken?"Anahtar gerekli":!data.chatId?"Sohbet seçilmeli":data.enabled?"Açık":"Bildirim kapalı";
    $("tgToken").placeholder=data.hasToken?"Anahtar kayıtlı — değiştirmek için girin":"BotFather anahtarını girin";
    if(!dirty)$("tgChatId").value=data.chatId || "";
    $("tgBotLink").hidden=!data.botUsername;
    if(data.botUsername) {
      $("tgBotLink").href=`https://t.me/${encodeURIComponent(data.botUsername)}`;
      $("tgBotLink").textContent=`@${data.botUsername} botunu Telegram'da aç`;
    }
    $("tgLast").textContent=data.lastError || (data.lastSentAt?`Son gönderim: ${new Date(data.lastSentAt).toLocaleString("tr-TR")}`:"");
    const chats=data.chatId?[]:data.chats || [],signature=JSON.stringify(chats);
    $("tgChats").hidden=!chats.length;
    if(signature!==lastChoices) {
      $("tgChats").replaceChildren();lastChoices=signature;
      if(chats.length) {
        $("tgChats").append(new Option("Bildirimin gideceği kendi sohbetinizi seçin",""));
        for(const chat of chats)$("tgChats").append(new Option(`${chat.label} (${chat.id})`,chat.id));
      }
    }
    if(!$("tgStatus").textContent)$("tgStatus").textContent=!data.hasToken?
      "BotFather anahtarını eklentideki alana girip Botu bağla / sohbeti bul'a basın.":
      !data.chatId?chats.length?"Aşağıdaki listeden hedef sohbetinizi seçin; seçim yapılmadan bildirim gönderilmez.":
        "Botunuza Telegram'da /start gönderin; ardından Botu bağla / sohbeti bul'a basıp sohbeti seçin.":
      data.enabled?"Telegram bağlı. Deneme mesajı ile gönderimi kontrol edebilirsiniz.":"Açmak için Telegram'a da bildir kutusunu işaretleyin.";
  }
  async function refresh() {if(!busy)try{render(await send("TELEGRAM_VIEW"));}catch(e){$("tgStatus").textContent=e.message;}}
  async function work(task) {
    if(busy)return;busy=true;
    for(const id of ["tgConnect","tgTest","tgRemove","tgToken","tgChatId","tgFile","tgChats","telegramEnabled"])$(id).disabled=true;
    $("tgStatus").textContent="İşlem yapılıyor…";
    try {await task();}catch(e){$("tgStatus").textContent=e.message;}
    finally{busy=false;for(const id of ["tgConnect","tgToken","tgChatId","tgFile","tgChats"])$(id).disabled=false;await refresh();}
  }
  async function connect() {
    const data=await send("TELEGRAM_CONNECT",{config:{botToken:$("tgToken").value.trim(),chatId:$("tgChatId").value.trim()}});
    $("tgToken").value="";dirty=false;render(data);
    $("tgStatus").textContent=data.chatId?"Telegram bağlı. Boş koltuk uyarıları bu sohbete gönderilecek.":
      data.chats?.length?"Bildirimin gideceği kendinize ait hedef sohbeti seçin.":"Botu Telegram'da açıp /start gönderin; ardından Botu bağla / sohbeti bul'a basın.";
  }
  $("tgConnect").addEventListener("click",()=>work(connect));
  $("tgChats").addEventListener("change",()=>{
    if(!$("tgChats").value)return;$("tgChatId").value=$("tgChats").value;dirty=true;void work(connect);
  });
  $("tgToken").addEventListener("input",()=>{dirty=true;});$("tgChatId").addEventListener("input",()=>{dirty=true;});
  $("tgFile").addEventListener("change",()=>work(async()=>{
    const file=$("tgFile").files[0];if(!file)return;
    if(file.size>65536)throw new Error("64 KB'tan küçük bir anahtar/ayar dosyası seçin.");
    const data=parseTelegramFile(await file.text());
    $("tgToken").value=data.botToken;$("tgChatId").value=data.chatId;dirty=true;$("tgFile").value="";
    await connect();
  }));
  $("telegramEnabled").addEventListener("change",()=>work(async()=>{
    render(await send("TELEGRAM_ENABLED",{enabled:$("telegramEnabled").checked}));
    $("tgStatus").textContent=view.enabled?"Telegram bildirimleri açık.":"Telegram bildirimleri kapalı.";
  }));
  $("tgTest").addEventListener("click",()=>work(async()=>{
    render(await send("TELEGRAM_TEST"));$("tgStatus").textContent="Deneme mesajı Telegram'a gönderildi.";
  }));
  $("tgRemove").addEventListener("click",()=>work(async()=>{
    dirty=false;$("tgToken").value="";render(await send("TELEGRAM_DISCONNECT"));$("tgStatus").textContent="Telegram anahtarı ve bağlantı kaldırıldı.";
  }));
  void refresh();setInterval(refresh,5000);
}
