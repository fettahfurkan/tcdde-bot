chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message.target!=="audio" || message.type!=="PLAY") return;
  const audio=document.getElementById("alarm");
  audio.currentTime=0;
  audio.play().then(()=>respond({ok:true})).catch(()=>respond({ok:false}));
  return true;
});
