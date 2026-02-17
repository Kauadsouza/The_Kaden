console.log("✅ app.js carregou!");

// ================== API (BLINDADO) ==================
async function parseJsonSafeResponse(r, urlLabel){
  const text = await r.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Resposta não-JSON em ${urlLabel}:\n${text.slice(0, 140)}...`);
  }

  if(!r.ok){
    throw new Error(data?.error || `HTTP ${r.status} em ${urlLabel}`);
  }

  return data;
}

async function apiGet(url){
  const r = await fetch(url);
  return parseJsonSafeResponse(r, `GET ${url}`);
}

async function apiSend(url, method, body){
  const r = await fetch(url, {
    method,
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body || {})
  });
  return parseJsonSafeResponse(r, `${method} ${url}`);
}

async function apiPost(url, body){ return apiSend(url, "POST", body); }
async function apiPatch(url, body){ return apiSend(url, "PATCH", body); }

// upload (continua POST multipart)
async function uploadFile(file){
  const fd = new FormData();
  fd.append("file", file);

  const r = await fetch("/api/media/upload", { method:"POST", body: fd });
  return parseJsonSafeResponse(r, "POST /api/media/upload");
}

// delete físico
async function apiDeleteMedia(relPath){
  const r = await fetch("/api/media/delete", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ path: relPath })
  });
  return parseJsonSafeResponse(r, "POST /api/media/delete");
}

// ================== TABS (se existir) ==================
function initTabs(){
  const tabBtns = Array.from(document.querySelectorAll(".tabBtn"));
  const tabs = Array.from(document.querySelectorAll(".tab"));
  if(!tabBtns.length || !tabs.length) return;

  function openTab(tabId){
    tabs.forEach(t => t.classList.toggle("active", t.id === tabId));
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => openTab(btn.dataset.tab));
  });
}
initTabs();

// ================== ELEMENTOS ==================
const elStatus  = document.getElementById("status");
const elQrBox   = document.getElementById("qrBox");
const elErr     = document.getElementById("err");
const elRespond = document.getElementById("respondEnabled");

// Topbar
const btnRefreshTop = document.getElementById("btnRefreshTop");
const elHelloTitle  = document.getElementById("helloTitle");
const elUserName    = document.getElementById("userName");

// Sidebar pills
const elSideBotState     = document.getElementById("sideBotState");
const elSideRespondState = document.getElementById("sideRespondState");

// Hero / dashboard (se existirem)
const elDashBot      = document.getElementById("dashBot");
const elDashRespond  = document.getElementById("dashRespond");
const elDashProducts = document.getElementById("dashProducts");
const elDashError    = document.getElementById("dashError");

// Glass panel (se existir)
const elGpBot     = document.getElementById("gpBot");
const elGpRespond = document.getElementById("gpRespond");

// Botões runtime
const btnStart   = document.getElementById("btnStart");
const btnStop    = document.getElementById("btnStop");
const btnRefresh = document.getElementById("btnRefresh");
const btnSaveLocks = document.getElementById("btnSaveLocks");

// Multi-produtos
const prodSelect       = document.getElementById("prodSelect");
const btnAddProduct    = document.getElementById("btnAddProduct");
const btnRemoveProduct = document.getElementById("btnRemoveProduct");
const prodStatus       = document.getElementById("prodStatus");

// Produto (inputs) - NOVO MODELO
const pNome    = document.getElementById("pNome");
const pSummary = document.getElementById("pSummary");
const btnSaveProduct = document.getElementById("btnSaveProduct");

// Upload (inputs + botões)
const photoFile = document.getElementById("photoFile");
const videoFile = document.getElementById("videoFile");
const btnUploadPhoto = document.getElementById("btnUploadPhoto");
const btnUploadVideo = document.getElementById("btnUploadVideo");
const photoMsg = document.getElementById("photoMsg");
const videoMsg = document.getElementById("videoMsg");

// Listas
const photoList = document.getElementById("photoList");
const videoList = document.getElementById("videoList");

// Textos do bot (TAB Mensagens)
const tGreeting    = document.getElementById("tGreeting");
const tMenu        = document.getElementById("tMenu");
const tHuman       = document.getElementById("tHuman");
const tAfterMedia  = document.getElementById("tAfterMedia");
const btnSaveTexts = document.getElementById("btnSaveTexts");
const textStatus   = document.getElementById("textStatus");

// ✅ RESPOSTAS RÁPIDAS (config.texts)
const tMiniMenu            = document.getElementById("tMiniMenu");
const tFallbackMenu        = document.getElementById("tFallbackMenu");
const tAskMediaAgain       = document.getElementById("tAskMediaAgain");
const tNoMediaOk           = document.getElementById("tNoMediaOk");
const tSendingMedia        = document.getElementById("tSendingMedia");
const tNoMediaAvailable    = document.getElementById("tNoMediaAvailable");
const tChooseProductNumber = document.getElementById("tChooseProductNumber");
const tInvalidProductNumber= document.getElementById("tInvalidProductNumber");

// ====== SIMULAÇÃO (TAB Mensagens) ======
const tAskName            = document.getElementById("tAskName");
const tAskCPF             = document.getElementById("tAskCPF");
const tAskBirth           = document.getElementById("tAskBirth");
const tAskType            = document.getElementById("tAskType");
const tAsk3Years          = document.getElementById("tAsk3Years");

const tAskFirstHome       = document.getElementById("tAskFirstHome");
const tAskHasDebts        = document.getElementById("tAskHasDebts");
const tAskDependents      = document.getElementById("tAskDependents");
const tAskDependentsCount = document.getElementById("tAskDependentsCount");

const tAskVisit           = document.getElementById("tAskVisit");
const tDonePF             = document.getElementById("tDonePF");
const tNoVisit            = document.getElementById("tNoVisit");

// ================== ESTADO ==================
let selectedIndex = 0;
let isRefreshing = false;

// ================== NOME DO USUÁRIO (front) ==================
function getUserName(){
  const n = (localStorage.getItem("kaden_user_name") || "").trim();
  return n || "Usuário";
}
function paintHello(){
  if(elUserName) elUserName.textContent = getUserName();
  // se você preferir editar direto no helloTitle sem span:
  // if(elHelloTitle) elHelloTitle.textContent = `Olá, ${getUserName()}!! 👋`;
}
paintHello();

// ================== AUTOSAVE (produto) ==================
let cfgCache = null;

function debounceWithFlush(fn, delay = 600){
  let t = null;
  let lastArgs = null;

  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...(lastArgs || []));
    }, delay);
  };

  debounced.flush = () => {
    if(!t) return;
    clearTimeout(t);
    t = null;
    fn(...(lastArgs || []));
  };

  return debounced;
}

// ======= anti-reset (dirty) =======
function markDirty(el, dirty){
  if(!el) return;
  el.dataset.dirty = dirty ? "1" : "0";
}
function isDirty(el){
  return !!el && el.dataset.dirty === "1";
}
function isFocused(el){
  return !!el && document.activeElement === el;
}
function setIfSafe(el, value){
  if(!el) return;
  if(isFocused(el)) return;
  if(isDirty(el)) return;
  el.value = value ?? "";
}

// ================== HELPERS ==================
function safeArr(v){ return Array.isArray(v) ? v : []; }

function normalizeConfigToProducts(cfg){
  cfg = cfg || {};
  if (Array.isArray(cfg.products) && cfg.products.length) return cfg;

  if (cfg.product && typeof cfg.product === "object") {
    cfg.products = [cfg.product];
    return cfg;
  }

  // cria 1 produto padrão
  cfg.products = [{
    nome:"Residencial Example",
    fotos:[],
    videos:[],
    productSummary: ""
  }];
  return cfg;
}

function ensureSimulation(cfg){
  if(!cfg.simulation || typeof cfg.simulation !== "object") cfg.simulation = {};
  const s = cfg.simulation;

  if(typeof s.askName !== "string") s.askName = "Qual seu nome completo?";
  if(typeof s.askCPF !== "string") s.askCPF = "Qual seu CPF?";
  if(typeof s.askBirth !== "string") s.askBirth = "Qual sua data de nascimento? (DD/MM/AAAA)";
  if(typeof s.askType !== "string") s.askType = "Você é CLT ou PJ?";
  if(typeof s.ask3Years !== "string") s.ask3Years = "Você tem mais de 3 anos de carteira assinada? (sim/não)";

  if(typeof s.askFirstHome !== "string") s.askFirstHome = "Esse será seu primeiro imóvel? (sim/não)";
  if(typeof s.askHasDebts !== "string") s.askHasDebts = "Você possui alguma pendência no nome? (sim/não)";
  if(typeof s.askDependents !== "string") s.askDependents = "Você possui dependentes? (sim/não)";
  if(typeof s.askDependentsCount !== "string") s.askDependentsCount = "Quantos dependentes você tem?";

  if(typeof s.askVisit !== "string") s.askVisit = "Posso agendar a visita na casa modelo? (sim/não)";

  if(typeof s.donePF !== "string"){
    s.donePF =
`Perfeito! Aqui está um resumo das informações 👇

• Nome: {nome}
• CPF: {cpfMask}
• Nascimento: {nascimento}
• Tipo de renda: {tipo}
• 3+ anos: {clt3anos}
• Primeiro imóvel: {primeiroImovel}
• Pendências: {pendencias}
• Dependentes: {dependentes}

Posso agendar a visita na casa modelo? (sim/não)`;
  }

  if(typeof s.noVisit !== "string"){
    s.noVisit = "Sem problemas 😊\nVou chamar um humano agora para continuar seu atendimento e te ajudar da melhor forma possível.";
  }

  return cfg;
}

function ensureTexts(cfg){
  if(!cfg.texts || typeof cfg.texts !== "object") cfg.texts = {};
  const t = cfg.texts;

  if(typeof t.miniMenu !== "string") t.miniMenu =
    "O que você quer fazer agora?\n\n1) Ver outro empreendimento\n2) Fazer uma simulação\n3) Falar com um corretor\n\nResponda com 1, 2, 3 ou \"menu\".";
  if(typeof t.fallbackMenu !== "string") t.fallbackMenu =
    "Para continuar, digite 1, 2 ou 3 (ou \"menu\").";
  if(typeof t.askMediaAgain !== "string") t.askMediaAgain =
    "Responda com \"sim\" ou \"não\" para as mídias 🙂";
  if(typeof t.noMediaOk !== "string") t.noMediaOk = "Sem problema 😊";
  if(typeof t.sendingMedia !== "string") t.sendingMedia =
    "Perfeito! Vou te enviar *fotos e vídeos* agora ✅";
  if(typeof t.noMediaAvailable !== "string") t.noMediaAvailable =
    "⚠️ Ainda não temos fotos ou vídeos cadastrados para este empreendimento.";
  if(typeof t.chooseProductNumber !== "string") t.chooseProductNumber =
    "Me diga o número do empreendimento.\nEx: *1* ou *quero a casa 1*";
  if(typeof t.invalidProductNumber !== "string") t.invalidProductNumber =
    "Número inválido. Escolha entre 1 e {limit}.";

  return cfg;
}

function getSelectedProduct(cfg){
  const list = safeArr(cfg.products);
  if(!list.length) return null;

  const idx = Math.min(Math.max(selectedIndex, 0), list.length - 1);
  selectedIndex = idx;
  return list[idx];
}

function productLabel(p, i){
  const nome = (p?.nome || `Produto ${i+1}`).trim();
  return nome || `Produto ${i+1}`;
}

// ✅ não sobrescreve enquanto você digita
function setInputsFromProduct(p){
  if(!p) return;

  setIfSafe(pNome, p.nome || "");

  const tpl = (typeof p.productSummary === "string") ? p.productSummary : "";
  setIfSafe(pSummary, tpl);
}

function updateProductFromInputs(p){
  p.nome = (pNome?.value || "").trim();
  p.productSummary = (pSummary?.value || "").trim();

  p.fotos  = safeArr(p.fotos);
  p.videos = safeArr(p.videos);
}

function renderProductSelect(cfg){
  if(!prodSelect) return;
  const list = safeArr(cfg.products);
  prodSelect.innerHTML = "";

  list.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = productLabel(p, i);
    prodSelect.appendChild(opt);
  });

  selectedIndex = Math.min(Math.max(selectedIndex, 0), Math.max(list.length - 1, 0));
  prodSelect.value = String(selectedIndex);
}

function renderMediaList(container, arr, kind){
  if(!container) return;
  container.innerHTML = "";
  const list = safeArr(arr);

  if(!list.length){
    container.innerHTML = `<div style="opacity:.7">Nenhum item.</div>`;
    return;
  }

  list.forEach((p, idx) => {
    container.insertAdjacentHTML("beforeend", `
      <div class="item" style="display:flex;gap:10px;align-items:center;justify-content:space-between;">
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${p}
        </div>
        <button type="button" class="danger" data-kind="${kind}" data-idx="${idx}">Remover</button>
      </div>
    `);
  });

  container.querySelectorAll("button.danger").forEach(btn => {
    btn.onclick = async () => {
      try{
        const kind = btn.dataset.kind;
        const idx  = Number(btn.dataset.idx);

        let cfg = normalizeConfigToProducts(await apiGet("/api/config"));
        cfg = ensureSimulation(cfg);
        cfg = ensureTexts(cfg);

        const p = getSelectedProduct(cfg);
        if(!p) return;

        const arrRef  = (kind === "foto") ? safeArr(p.fotos) : safeArr(p.videos);
        const relPath = arrRef[idx];
        if(!relPath) return;

        if(!confirm(`Remover este arquivo?\n${relPath}`)) return;

        const newArr = arrRef.filter((_, i) => i !== idx);
        if(kind === "foto") p.fotos = newArr;
        else p.videos = newArr;

        cfg.product = cfg.products[0];
        await apiPatch("/api/config", cfg);

        await apiDeleteMedia(relPath);
        await refresh();
      } catch(e){
        console.error(e);
        alert("Erro ao remover: " + (e?.message || e));
      }
    };
  });
}

function fillTextsFromCfg(cfg){
  setIfSafe(tGreeting, cfg.greeting || "");
  setIfSafe(tMenu, cfg.menu || "");
  setIfSafe(tHuman, cfg.humanMessage || "");
  setIfSafe(tAfterMedia, cfg.afterMedia || "");

  const s = cfg.simulation || {};
  setIfSafe(tAskName, s.askName || "");
  setIfSafe(tAskCPF, s.askCPF || "");
  setIfSafe(tAskBirth, s.askBirth || "");
  setIfSafe(tAskType, s.askType || "");
  setIfSafe(tAsk3Years, s.ask3Years || "");

  setIfSafe(tAskFirstHome, s.askFirstHome || "");
  setIfSafe(tAskHasDebts, s.askHasDebts || "");
  setIfSafe(tAskDependents, s.askDependents || "");
  setIfSafe(tAskDependentsCount, s.askDependentsCount || "");

  setIfSafe(tAskVisit, s.askVisit || "");
  setIfSafe(tDonePF, s.donePF || "");
  setIfSafe(tNoVisit, s.noVisit || "");

  const tx = cfg.texts || {};
  setIfSafe(tMiniMenu, tx.miniMenu || "");
  setIfSafe(tFallbackMenu, tx.fallbackMenu || "");
  setIfSafe(tAskMediaAgain, tx.askMediaAgain || "");
  setIfSafe(tNoMediaOk, tx.noMediaOk || "");
  setIfSafe(tSendingMedia, tx.sendingMedia || "");
  setIfSafe(tNoMediaAvailable, tx.noMediaAvailable || "");
  setIfSafe(tChooseProductNumber, tx.chooseProductNumber || "");
  setIfSafe(tInvalidProductNumber, tx.invalidProductNumber || "");
}

// campos de textos globais/simulação + texts.*
const textFields = [
  tGreeting, tMenu, tHuman, tAfterMedia,

  tMiniMenu, tFallbackMenu, tAskMediaAgain, tNoMediaOk,
  tSendingMedia, tNoMediaAvailable, tChooseProductNumber, tInvalidProductNumber,

  tAskName, tAskCPF, tAskBirth, tAskType, tAsk3Years,
  tAskFirstHome, tAskHasDebts, tAskDependents, tAskDependentsCount,
  tAskVisit, tDonePF, tNoVisit
].filter(Boolean);

function wireDirtyTexts(){
  textFields.forEach(el => {
    markDirty(el, false);
    el.addEventListener("input", () => markDirty(el, true));
  });
}
wireDirtyTexts();

function clearTextsDirty(){
  textFields.forEach(el => markDirty(el, false));
}

// campos do produto (nome + template)
const productFields = [pNome, pSummary].filter(Boolean);

function wireDirtyProducts(){
  productFields.forEach(el => {
    markDirty(el, false);
    el.addEventListener("input", () => markDirty(el, true));
  });
}
wireDirtyProducts();

function clearProductsDirty(){
  productFields.forEach(el => markDirty(el, false));
}

// === autosave helpers (usa cfgCache) ===
function syncSelectedProductToCache(){
  if(!cfgCache) return;
  cfgCache = normalizeConfigToProducts(cfgCache);
  const p = getSelectedProduct(cfgCache);
  if(!p) return;
  updateProductFromInputs(p);
}

const autosaveProductDebounced = debounceWithFlush(async () => {
  try{
    if(!cfgCache) return;

    cfgCache.product = cfgCache.products?.[0];
    await apiPatch("/api/config", cfgCache);

    if(prodStatus){
      prodStatus.textContent = "💾 Salvo automaticamente";
      setTimeout(()=> { if(prodStatus) prodStatus.textContent = ""; }, 1000);
    }

    clearProductsDirty();
  } catch(e){
    console.error(e);
    if(prodStatus) prodStatus.textContent = "⚠️ Erro no autosave";
  }
}, 600);

// autosave enquanto digita
if(pNome){
  pNome.addEventListener("input", () => {
    syncSelectedProductToCache();
    autosaveProductDebounced();
  });
}
if(pSummary){
  pSummary.addEventListener("input", () => {
    syncSelectedProductToCache();
    autosaveProductDebounced();
  });
}

// ================== STATUS UI HELPERS ==================
function setStatusChip(text, kind){
  if(!elStatus) return;
  elStatus.textContent = text;

  // remove classes antigas
  elStatus.classList.remove("isOk", "isWarn", "isBad");
  if(kind === "ok") elStatus.classList.add("isOk");
  if(kind === "warn") elStatus.classList.add("isWarn");
  if(kind === "bad") elStatus.classList.add("isBad");
}

function setText(el, txt){
  if(!el) return;
  el.textContent = txt;
}

// ================== REFRESH ==================
async function refresh(){
  if(isRefreshing) return;
  isRefreshing = true;

  try{
    const st    = await apiGet("/api/bot/status");
    const locks = await apiGet("/api/locks");
    let cfg     = await apiGet("/api/config");

    cfg = normalizeConfigToProducts(cfg);
    cfg = ensureSimulation(cfg);
    cfg = ensureTexts(cfg);

    // guarda cache pro autosave
    cfgCache = cfg;

    if(elRespond) elRespond.checked = !!locks.respondEnabled;

    // status principal (topo)
    if(st.connected){
      setStatusChip("Conectado ✅", "ok");
    } else if(st.started){
      setStatusChip("Rodando…", "warn");
    } else {
      setStatusChip("Parado", "bad");
    }

    // sidebar pills (mantém funcionando)
    if(elSideBotState){
      elSideBotState.textContent = st.connected ? "Bot: Conectado ✅" : (st.started ? "Bot: Rodando…" : "Bot: Parado");
    }
    if(elSideRespondState){
      elSideRespondState.textContent = locks.respondEnabled ? "Responder: Ligado ✅" : "Responder: Desligado";
    }

    // painéis opcionais (se existirem no HTML)
    setText(elDashBot, st.connected ? "Conectado ✅" : (st.started ? "Rodando…" : "Parado"));
    setText(elDashRespond, locks.respondEnabled ? "Ligado ✅" : "Desligado");
    setText(elDashProducts, String((cfg.products || []).length || 0));

    setText(elGpBot, st.connected ? "Conectado ✅" : (st.started ? "Rodando…" : "Parado"));
    setText(elGpRespond, locks.respondEnabled ? "Ligado ✅" : "Desligado");

    // erro
    if(elErr) elErr.textContent = st.lastError ? `Erro: ${st.lastError}` : "";
    if(elDashError) elDashError.textContent = st.lastError ? `Erro: ${st.lastError}` : "";

    // QR
    if(elQrBox){
      if(st.connected){
        elQrBox.innerHTML = "Conectado ✅ (sem QR)";
      } else {
        const qr = await apiGet("/api/bot/qr");
        elQrBox.innerHTML = qr?.qr
          ? `<img src="${qr.qr}" style="max-width:320px;border-radius:12px;">`
          : "Sem QR";
      }
    }

    // textos globais + simulação + texts.*
    fillTextsFromCfg(cfg);

    // produtos
    renderProductSelect(cfg);
    const p = getSelectedProduct(cfg);
    setInputsFromProduct(p);

    // mídias por produto
    renderMediaList(photoList, p?.fotos || [], "foto");
    renderMediaList(videoList, p?.videos || [], "video");

  } catch(e){
    console.error(e);
    if(elErr) elErr.textContent = "Erro no refresh: " + (e?.message || e);
    setStatusChip("Erro ⚠️", "bad");
  } finally {
    isRefreshing = false;
  }
}

// ================== EVENTS ==================
if(btnStart)   btnStart.onclick   = async () => { await apiPost("/api/bot/start"); await refresh(); };
if(btnStop)    btnStop.onclick    = async () => { await apiPost("/api/bot/stop"); await refresh(); };
if(btnRefresh) btnRefresh.onclick = refresh;

// ✅ Topbar atualizar
if(btnRefreshTop) btnRefreshTop.onclick = refresh;

// salvar locks
if(btnSaveLocks){
  btnSaveLocks.onclick = async () => {
    const locks = await apiGet("/api/locks");
    locks.respondEnabled = !!elRespond.checked;
    await apiPatch("/api/locks", locks);
    await refresh();
  };
}

// ✅ troca produto: salva antes de trocar + troca nome/template/mídias
if(prodSelect){
  prodSelect.onchange = async () => {
    // salva alterações do produto atual antes de trocar
    if(isDirty(pNome) || isDirty(pSummary)){
      syncSelectedProductToCache();
      autosaveProductDebounced.flush();
    }

    selectedIndex = Number(prodSelect.value || 0);

    // libera pra carregar o template do produto novo
    markDirty(pNome, false);
    markDirty(pSummary, false);

    clearProductsDirty();
    await refresh();
  };
}

// adicionar produto
if(btnAddProduct){
  btnAddProduct.onclick = async () => {
    try{
      const cfg = normalizeConfigToProducts(await apiGet("/api/config"));
      cfg.products = safeArr(cfg.products);

      const cur = getSelectedProduct(cfg);
      const baseTpl = (cur?.productSummary || "").trim();

      cfg.products.push({
        nome: "Novo produto",
        fotos: [],
        videos: [],
        productSummary: baseTpl
      });

      cfg.product = cfg.products[0];
      await apiPatch("/api/config", cfg);

      selectedIndex = cfg.products.length - 1;

      markDirty(pNome, false);
      markDirty(pSummary, false);

      clearProductsDirty();
      await refresh();
    } catch(e){
      console.error(e);
      alert("Erro ao adicionar produto: " + (e?.message || e));
    }
  };
}

// remover produto
if(btnRemoveProduct){
  btnRemoveProduct.onclick = async () => {
    try{
      const cfg = normalizeConfigToProducts(await apiGet("/api/config"));
      cfg.products = safeArr(cfg.products);

      if(cfg.products.length <= 1){
        alert("Você precisa ter pelo menos 1 produto.");
        return;
      }

      const p = cfg.products[selectedIndex];
      const label = (p?.nome || `Produto ${selectedIndex+1}`).trim() || `Produto ${selectedIndex+1}`;

      if(!confirm(`Remover este produto?\n\n${label}\n\n(As mídias NÃO serão apagadas automaticamente)`)) return;

      cfg.products.splice(selectedIndex, 1);
      selectedIndex = Math.max(0, selectedIndex - 1);

      cfg.product = cfg.products[0];
      await apiPatch("/api/config", cfg);

      markDirty(pNome, false);
      markDirty(pSummary, false);

      clearProductsDirty();
      await refresh();
    } catch(e){
      console.error(e);
      alert("Erro ao remover produto: " + (e?.message || e));
    }
  };
}

// ✅ salvar produto (nome + template) — ainda funciona, mas autosave já faz isso
if(btnSaveProduct){
  btnSaveProduct.onclick = async () => {
    try{
      const cfg = normalizeConfigToProducts(await apiGet("/api/config"));
      const p = getSelectedProduct(cfg);
      if(!p){
        alert("Nenhum produto selecionado.");
        return;
      }

      updateProductFromInputs(p);

      cfg.product = cfg.products[0];
      await apiPatch("/api/config", cfg);

      clearProductsDirty();

      if(prodStatus){
        prodStatus.textContent = "✅ Produto salvo!";
        setTimeout(()=> prodStatus.textContent = "", 1800);
      }

      await refresh();
    } catch(e){
      console.error(e);
      alert("Erro ao salvar produto: " + (e?.message || e));
    }
  };
}

// upload foto
if(btnUploadPhoto){
  btnUploadPhoto.onclick = async () => {
    try{
      if(photoMsg) photoMsg.textContent = "";
      const f = photoFile?.files?.[0];
      if(!f){ if(photoMsg) photoMsg.textContent = "Selecione uma foto."; return; }

      btnUploadPhoto.disabled = true;
      if(photoMsg) photoMsg.textContent = "Enviando...";

      const up = await uploadFile(f);
      btnUploadPhoto.disabled = false;

      if(!up.ok){
        if(photoMsg) photoMsg.textContent = "Erro: " + (up.error || "upload falhou");
        return;
      }

      const cfg = normalizeConfigToProducts(await apiGet("/api/config"));
      const p = getSelectedProduct(cfg);
      if(!p){ if(photoMsg) photoMsg.textContent = "Sem produto selecionado."; return; }

      p.fotos = safeArr(p.fotos);
      p.fotos.push(up.path);

      cfg.product = cfg.products[0];
      await apiPatch("/api/config", cfg);

      if(photoFile) photoFile.value = "";
      if(photoMsg){
        photoMsg.textContent = "✅ Foto enviada!";
        setTimeout(()=> photoMsg.textContent = "", 1500);
      }

      await refresh();
    } catch(e){
      console.error(e);
      if(photoMsg) photoMsg.textContent = "Erro: " + (e?.message || e);
      btnUploadPhoto.disabled = false;
    }
  };
}

// upload vídeo
if(btnUploadVideo){
  btnUploadVideo.onclick = async () => {
    try{
      if(videoMsg) videoMsg.textContent = "";
      const f = videoFile?.files?.[0];
      if(!f){ if(videoMsg) videoMsg.textContent = "Selecione um vídeo."; return; }

      btnUploadVideo.disabled = true;
      if(videoMsg) videoMsg.textContent = "Enviando...";

      const up = await uploadFile(f);
      btnUploadVideo.disabled = false;

      if(!up.ok){
        if(videoMsg) videoMsg.textContent = "Erro: " + (up.error || "upload falhou");
        return;
      }

      const cfg = normalizeConfigToProducts(await apiGet("/api/config"));
      const p = getSelectedProduct(cfg);
      if(!p){ if(videoMsg) videoMsg.textContent = "Sem produto selecionado."; return; }

      p.videos = safeArr(p.videos);
      p.videos.push(up.path);

      cfg.product = cfg.products[0];
      await apiPatch("/api/config", cfg);

      if(videoFile) videoFile.value = "";
      if(videoMsg){
        videoMsg.textContent = "✅ Vídeo enviado!";
        setTimeout(()=> videoMsg.textContent = "", 1500);
      }

      await refresh();
    } catch(e){
      console.error(e);
      if(videoMsg) videoMsg.textContent = "Erro: " + (e?.message || e);
      btnUploadVideo.disabled = false;
    }
  };
}

// ✅ salvar textos + simulação + texts.* (NÃO mexe no template do produto)
if(btnSaveTexts){
  btnSaveTexts.onclick = async () => {
    try{
      let cfg = await apiGet("/api/config");
      cfg = normalizeConfigToProducts(cfg);
      cfg = ensureSimulation(cfg);
      cfg = ensureTexts(cfg);

      cfg.greeting     = (tGreeting?.value || "").trim();
      cfg.menu         = (tMenu?.value || "").trim();
      cfg.humanMessage = (tHuman?.value || "").trim();
      cfg.afterMedia   = (tAfterMedia?.value || "").trim();

      // ✅ texts.*
      cfg.texts.miniMenu            = (tMiniMenu?.value || "").trim();
      cfg.texts.fallbackMenu        = (tFallbackMenu?.value || "").trim();
      cfg.texts.askMediaAgain       = (tAskMediaAgain?.value || "").trim();
      cfg.texts.noMediaOk           = (tNoMediaOk?.value || "").trim();
      cfg.texts.sendingMedia        = (tSendingMedia?.value || "").trim();
      cfg.texts.noMediaAvailable    = (tNoMediaAvailable?.value || "").trim();
      cfg.texts.chooseProductNumber = (tChooseProductNumber?.value || "").trim();
      cfg.texts.invalidProductNumber= (tInvalidProductNumber?.value || "").trim();

      // ✅ simulation.*
      cfg.simulation.askName            = (tAskName?.value || "").trim();
      cfg.simulation.askCPF             = (tAskCPF?.value || "").trim();
      cfg.simulation.askBirth           = (tAskBirth?.value || "").trim();
      cfg.simulation.askType            = (tAskType?.value || "").trim();
      cfg.simulation.ask3Years          = (tAsk3Years?.value || "").trim();

      cfg.simulation.askFirstHome       = (tAskFirstHome?.value || "").trim();
      cfg.simulation.askHasDebts        = (tAskHasDebts?.value || "").trim();
      cfg.simulation.askDependents      = (tAskDependents?.value || "").trim();
      cfg.simulation.askDependentsCount = (tAskDependentsCount?.value || "").trim();

      cfg.simulation.askVisit           = (tAskVisit?.value || "").trim();
      cfg.simulation.donePF             = (tDonePF?.value || "").trim();
      cfg.simulation.noVisit            = (tNoVisit?.value || "").trim();

      // compat antigo
      cfg.product = cfg.products[0];

      await apiPatch("/api/config", cfg);

      clearTextsDirty();

      if(textStatus){
        textStatus.textContent = "✅ Textos salvos!";
        setTimeout(()=> textStatus.textContent = "", 1800);
      }

      await refresh();
    } catch(e){
      console.error(e);
      alert("Erro ao salvar textos: " + (e?.message || e));
    }
  };
}

// ================== START ==================
refresh();
setInterval(refresh, 2000);
