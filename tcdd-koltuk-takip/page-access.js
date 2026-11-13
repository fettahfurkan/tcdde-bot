// Vue 2, Vue 3 ve uyumluluk yapılarındaki sayfa kökünü bulur; #app kimliğine bağlı değildir.
(() => {
  function find() {
    const vms=[], components=[], vnodes=[], apps=[], seen=new Set(), nodes=new Set();
    let store=null, router=null, roots=0;
    const stores=[];
    const addStore=s=>{if(s?.getters && !stores.includes(s))stores.push(s);};
    function element(el) {
      if(!el || nodes.has(el))return;
      nodes.add(el);
      if(el.__vue__) {vms.push(el.__vue__);roots++;}
      if(el.__vue_app__) {apps.push(el.__vue_app__);roots++;}
      if(el.__vueParentComponent)components.push(el.__vueParentComponent);
      if(el._vnode)vnodes.push(el._vnode);
      if(el.__vnode)vnodes.push(el.__vnode);
    }
    function drain() {
      while((vms.length || components.length || vnodes.length || apps.length) && seen.size<5000) {
        const kind=vms.length?"vm":components.length?"component":vnodes.length?"vnode":"app";
        const value=(kind==="vm"?vms:kind==="component"?components:kind==="vnode"?vnodes:apps).shift();
        if(!value || typeof value!=="object" || seen.has(value))continue;
        seen.add(value);
        if(kind==="app") {
          const globals=value.config?.globalProperties || value._context?.config?.globalProperties;
          addStore(globals?.$store);router ||= globals?.$router;
          if(value._instance)components.push(value._instance);
          element(value._container);
          continue;
        }
        if(kind==="vnode") {
          if(value.componentInstance)vms.push(value.componentInstance);
          if(value.component)components.push(value.component);
          if(Array.isArray(value.children))vnodes.push(...value.children);
          if(Array.isArray(value.dynamicChildren))vnodes.push(...value.dynamicChildren);
          if(value.suspense?.activeBranch)vnodes.push(value.suspense.activeBranch);
          continue;
        }
        if(kind==="component") {
          if(value.proxy)vms.push(value.proxy);
          if(value.ctx)vms.push(value.ctx);
          if(value.parent)components.push(value.parent);
          if(value.subTree)vnodes.push(value.subTree);
          const globals=value.appContext?.config?.globalProperties;
          addStore(globals?.$store);router ||= globals?.$router;
          continue;
        }
        addStore(value.$store);router ||= value.$router;
        if(value.$root && value.$root!==value)vms.push(value.$root);
        if(value.$parent)vms.push(value.$parent);
        if(Array.isArray(value.$children))vms.push(...value.$children);
        if(value.$)components.push(value.$);
        if(value._vnode)vnodes.push(value._vnode);
        const data=Array.isArray(value.departureTrainList)?value:Array.isArray(value.$data?.departureTrainList)?value.$data:null;
        if(data && !findList) { findList=value; listData=data; }
      }
      store=stores.find(s=>"getSeferSearchInformation" in s.getters) || stores[0] || null;
    }
    let findList=null,listData=null;
    element(document.querySelector("#app"));
    for(const el of document.querySelectorAll("[data-v-app], #root, #__nuxt"))element(el);
    element(document.body);drain();
    if(!store || !findList) {
      let count=0;
      for(const el of document.querySelectorAll("*")) {element(el);if(++count>=15000)break;}
      drain();
    }
    return {store,router,list:findList,listData,diagnostics:{roots,objects:seen.size,hasStore:!!store,hasList:!!findList,
      readyState:document.readyState,path:location.pathname,cardButtons:document.querySelectorAll(".btnTicketType").length}};
  }
  Object.defineProperty(globalThis,"__tcddSeatWatchAccess",{value:{find},configurable:true});
})();
