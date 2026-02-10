// ==============================
// The Kaden • script.js (PERFEITO pro seu HTML)
// Tabs + Pill + 2 Steps + Captcha + Strength + PT/EN
// + integração backend: /api/register e /api/login
// ==============================

// ✅ Usa o backend fixo (porta do Node)
const API = "http://localhost:3001";

const T = {
  pt: {
    tagline: "Controle. Simples. Profissional.",

    tabLogin: "Entrar",
    tabRegister: "Criar conta",

    loginUserLabel: "Usuário ou e-mail",
    loginUserPh: "seu usuário ou email",
    loginPassLabel: "Senha",
    loginPassPh: "••••••••",
    remember: "Manter conectado",
    forgot: "Recuperar senha",
    loginBtn: "Continuar",

    regTitle: "Cadastrar nova empresa",
    step1: "Dados básicos",
    step2: "Segurança",

    personType: "Tipo de pessoa",
    docLabelPJ: "CNPJ",
    docLabelPF: "CPF",
    docHintPJ: "Digite o CNPJ no formato padrão.",
    docHintPF: "Digite o CPF no formato padrão.",

    fullName: "Nome completo",
    company: "Nome da empresa",
    next: "Próximo",
    back: "Voltar",

    regUserLabel: "Usuário",
    regUserPh: "ex: kaden_admin",
    regUserHelp: "3–20 caracteres • letras, números e _",
    regNameLabel: "Nome",
    regNamePh: "seu nome",
    regEmailLabel: "E-mail",
    regEmailPh: "seu@email.com",
    regPassLabel: "Senha",
    regPassPh: "mín. 8 caracteres",
    regPass2Label: "Confirmar senha",
    regPass2Ph: "repita a senha",

    captchaTitle: "Verificação",
    captchaSub: "Responda para continuar.",
    captchaBtn: "Gerar",

    agree: "Concordo com os Termos e Privacidade",
    regBtn: "Criar conta",

    privacy: "Privacidade",
    terms: "Termos",
    support: "Suporte",

    pages: {
      privacy: {
        title: "Privacidade",
        sub: "Placeholder (vamos criar depois).",
        body: `<div class="boxInfo">Aqui vai sua política de privacidade / LGPD.</div>`
      },
      terms: {
        title: "Termos",
        sub: "Placeholder (vamos criar depois).",
        body: `<div class="boxInfo">Aqui vão seus termos de uso e pagamentos.</div>`
      },
      support: {
        title: "Suporte",
        sub: "Placeholder (vamos criar depois).",
        body: `<div class="boxInfo">Aqui vai seu canal de suporte.</div>`
      }
    },

    toasts: {
      emailBad: "E-mail inválido.",
      userBad: "Usuário inválido.",
      passWeak: "Senha fraca.",
      passNoMatch: "As senhas não conferem.",
      captchaBad: "Captcha incorreto.",
      agree: "Aceite os termos para continuar.",
      apiDown: "Falha ao conectar no backend.",
      serverError: "Erro no servidor.",
      duplicated: "Usuário ou e-mail já existe.",
      step1Bad: "Preencha os dados da etapa 1.",
      loginOk: "Login realizado com sucesso!",
      registerOk: "Conta criada com sucesso!"
    },

    strength: ["Muito fraca", "Fraca", "Boa", "Forte"]
  },

  en: {
    tagline: "Control. Simple. Professional.",

    tabLogin: "Sign in",
    tabRegister: "Create account",

    loginUserLabel: "Username or email",
    loginUserPh: "your username or email",
    loginPassLabel: "Password",
    loginPassPh: "••••••••",
    remember: "Stay signed in",
    forgot: "Reset password",
    loginBtn: "Continue",

    regTitle: "Create new company",
    step1: "Basic data",
    step2: "Security",

    personType: "Person type",
    docLabelPJ: "Company ID",
    docLabelPF: "Personal ID",
    docHintPJ: "Enter the document in the standard format.",
    docHintPF: "Enter the document in the standard format.",

    fullName: "Full name",
    company: "Company name",
    next: "Next",
    back: "Back",

    regUserLabel: "Username",
    regUserPh: "e.g., kaden_admin",
    regUserHelp: "3–20 chars • letters, numbers and _",
    regNameLabel: "Name",
    regNamePh: "your name",
    regEmailLabel: "Email",
    regEmailPh: "you@email.com",
    regPassLabel: "Password",
    regPassPh: "min. 8 characters",
    regPass2Label: "Confirm password",
    regPass2Ph: "repeat password",

    captchaTitle: "Verification",
    captchaSub: "Answer to continue.",
    captchaBtn: "Generate",

    agree: "I agree to Terms & Privacy",
    regBtn: "Create account",

    privacy: "Privacy",
    terms: "Terms",
    support: "Support",

    pages: {
      privacy: {
        title: "Privacy",
        sub: "Placeholder (we'll write later).",
        body: `<div class="boxInfo">Your privacy policy goes here.</div>`
      },
      terms: {
        title: "Terms",
        sub: "Placeholder (we'll write later).",
        body: `<div class="boxInfo">Your terms of service go here.</div>`
      },
      support: {
        title: "Support",
        sub: "Placeholder (we'll write later).",
        body: `<div class="boxInfo">Your support channels go here.</div>`
      }
    },

    toasts: {
      emailBad: "Invalid email.",
      userBad: "Invalid username.",
      passWeak: "Weak password.",
      passNoMatch: "Passwords do not match.",
      captchaBad: "Wrong captcha.",
      agree: "Accept terms to continue.",
      apiDown: "Could not reach backend.",
      serverError: "Server error.",
      duplicated: "Username or email already exists.",
      step1Bad: "Fill step 1 fields.",
      loginOk: "Signed in successfully!",
      registerOk: "Account created successfully!"
    },

    strength: ["Very weak", "Weak", "Good", "Strong"]
  }
};

let lang = "pt";
let captchaValue = 0;
let regStep = 1;

const $ = (id) => document.getElementById(id);

function on(id, evt, fn) {
  const el = $(id);
  if (el) el.addEventListener(evt, fn);
}

function toast(message, isBad = false) {
  const el = $("toast");
  const msg = $("toastMsg");
  if (!el || !msg) return;

  el.classList.toggle("bad", !!isBad);
  msg.textContent = message;

  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
function validateUsername(u) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(u).trim());
}
function setInvalid(input, invalid) {
  if (!input) return;
  input.setAttribute("aria-invalid", invalid ? "true" : "false");
}

function scorePassword(pw) {
  const s = String(pw || "");
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  if (score <= 1) return 0;
  if (score === 2) return 1;
  if (score === 3) return 2;
  return 3;
}

function updateStrength() {
  const t = T[lang];
  const pw = $("regPass");
  const fill = $("strengthFill");
  const text = $("strengthText");
  if (!pw || !fill || !text) return;

  const level = scorePassword(pw.value);
  const widths = ["18%", "38%", "68%", "100%"];
  fill.style.width = widths[level];
  text.textContent = t.strength[level];
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  captchaValue = a + b;

  const q = $("captchaQuestion");
  const ans = $("captchaAnswer");
  if (q) q.textContent = `${a} + ${b} = ?`;
  if (ans) ans.value = "";
}

function togglePassword(inputId, btnId) {
  const input = $(inputId);
  const btn = $(btnId);
  if (!input || !btn) return;
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  btn.textContent = isPass ? "🙈" : "👁";
}

// ---------- pages (privacidade/termos/suporte)
function showViewAuth() {
  $("viewAuth")?.classList.add("isVisible");
  $("viewPage")?.classList.remove("isVisible");
}
function showViewPage(key) {
  const t = T[lang].pages[key];
  $("pageTitle").textContent = t.title;
  $("pageSub").textContent = t.sub;
  $("pageBody").innerHTML = t.body;
  $("viewAuth")?.classList.remove("isVisible");
  $("viewPage")?.classList.add("isVisible");
}

// ---------- Tabs + Pill
function movePill(activeBtn) {
  const pill = $("tabPill");
  if (!pill || !activeBtn) return;

  const left = activeBtn.offsetLeft;
  const width = activeBtn.offsetWidth;

  pill.style.width = `${width}px`;
  pill.style.transform = `translateX(${left}px)`;
}

function showLogin() {
  const tabLogin = $("tabLogin");
  const tabRegister = $("tabRegister");
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");

  tabLogin?.classList.add("isActive");
  tabLogin?.setAttribute("aria-selected", "true");
  tabRegister?.classList.remove("isActive");
  tabRegister?.setAttribute("aria-selected", "false");

  loginForm?.classList.add("isVisible");
  registerForm?.classList.remove("isVisible");

  setRegStep(1);
  requestAnimationFrame(() => movePill(tabLogin));
}

function showRegister() {
  const tabLogin = $("tabLogin");
  const tabRegister = $("tabRegister");
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");

  tabRegister?.classList.add("isActive");
  tabRegister?.setAttribute("aria-selected", "true");
  tabLogin?.classList.remove("isActive");
  tabLogin?.setAttribute("aria-selected", "false");

  registerForm?.classList.add("isVisible");
  loginForm?.classList.remove("isVisible");

  generateCaptcha();
  updateStrength();
  setRegStep(1);

  requestAnimationFrame(() => movePill(tabRegister));
}

// ---------- Cadastro 2 etapas
function setRegStep(step) {
  regStep = step;

  const pane1 = $("pane1");
  const pane2 = $("pane2");
  const fill = $("stepFill");
  const s1 = document.querySelector('.step[data-step="1"]');
  const s2 = document.querySelector('.step[data-step="2"]');

  if (pane1 && pane2) {
    if (step === 1) {
      pane1.classList.add("isVisible");
      pane2.classList.remove("isVisible");
    } else {
      pane1.classList.remove("isVisible");
      pane2.classList.add("isVisible");
    }
  }

  if (fill) fill.style.width = (step === 1 ? "0%" : "100%");

  s1?.classList.toggle("isActive", step === 1);
  s2?.classList.toggle("isActive", step === 2);
}

function validateStep1() {
  const t = T[lang];

  const personType = $("personType");
  const doc = $("doc");
  const fullName = $("fullName");
  const email = $("regEmail");
  const company = $("company");

  const okType = !!personType?.value;
  const okDoc = (doc?.value || "").trim().length >= 5;
  const okFull = (fullName?.value || "").trim().length >= 2;
  const okEmail = validateEmail((email?.value || "").trim());
  const okCompany = (company?.value || "").trim().length >= 2;

  setInvalid(doc, !okDoc);
  setInvalid(fullName, !okFull);
  setInvalid(email, !okEmail);
  setInvalid(company, !okCompany);

  if (!okType || !okDoc || !okFull || !okEmail || !okCompany) {
    toast(t.toasts.step1Bad, true);
    return false;
  }
  return true;
}

function updateDocLabel() {
  const t = T[lang];
  const personType = $("personType");
  const docLabel = $("t_docLabel");
  const docHint = $("docHint");
  if (!personType || !docLabel || !docHint) return;

  const isPJ = personType.value === "pj";
  docLabel.textContent = isPJ ? t.docLabelPJ : t.docLabelPF;
  docHint.textContent = isPJ ? t.docHintPJ : t.docHintPF;

  const doc = $("doc");
  if (doc) doc.placeholder = isPJ ? "XX.XXX.XXX/XXXX-XX" : "XXX.XXX.XXX-XX";
}

// ---------- Language
function applyLang(next) {
  lang = next;
  const t = T[lang];
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en-US";

  $("t_tagline").textContent = t.tagline;

  $("tabLogin").textContent = t.tabLogin;
  $("tabRegister").textContent = t.tabRegister;

  $("t_login_user_label").textContent = t.loginUserLabel;
  $("loginUser").placeholder = t.loginUserPh;

  $("t_login_pass_label").textContent = t.loginPassLabel;
  $("loginPass").placeholder = t.loginPassPh;

  $("t_remember").textContent = t.remember;
  $("forgotLink").textContent = t.forgot;
  $("t_login_btn").textContent = t.loginBtn;

  $("t_reg_title").textContent = t.regTitle;
  $("t_step1").textContent = t.step1;
  $("t_step2").textContent = t.step2;

  $("t_personType").textContent = t.personType;
  $("t_fullName").textContent = t.fullName;
  $("t_company").textContent = t.company;

  $("btnNextStep").textContent = t.next;
  $("btnPrevStep").textContent = t.back;

  $("t_reg_user_label").textContent = t.regUserLabel;
  $("regUser").placeholder = t.regUserPh;
  $("t_reg_user_help").textContent = t.regUserHelp;

  $("t_reg_name_label").textContent = t.regNameLabel;
  $("regName").placeholder = t.regNamePh;

  $("t_reg_email_label").textContent = t.regEmailLabel;
  $("regEmail").placeholder = t.regEmailPh;

  $("t_reg_pass_label").textContent = t.regPassLabel;
  $("regPass").placeholder = t.regPassPh;

  $("t_reg_pass2_label").textContent = t.regPass2Label;
  $("regPass2").placeholder = t.regPass2Ph;

  $("t_captcha_title").textContent = t.captchaTitle;
  $("t_captcha_sub").textContent = t.captchaSub;
  $("regenCaptcha").textContent = t.captchaBtn;

  $("t_agree").textContent = t.agree;
  $("t_reg_btn").textContent = t.regBtn;

  $("linkPrivacy").textContent = t.privacy;
  $("linkTerms").textContent = t.terms;
  $("linkSupport").textContent = t.support;

  updateDocLabel();
  updateStrength();
}

// ---------- helpers backend
async function safeJson(res) {
  try { return await res.json(); }
  catch { return {}; }
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = String(new Date().getFullYear());

  on("tabLogin", "click", showLogin);
  on("tabRegister", "click", showRegister);

  on("btnBR", "click", () => {
    $("btnBR").setAttribute("aria-pressed", "true");
    $("btnUS").setAttribute("aria-pressed", "false");
    applyLang("pt");
    localStorage.setItem("thekaden_lang", "pt");
  });

  on("btnUS", "click", () => {
    $("btnUS").setAttribute("aria-pressed", "true");
    $("btnBR").setAttribute("aria-pressed", "false");
    applyLang("en");
    localStorage.setItem("thekaden_lang", "en");
  });

  on("linkPrivacy", "click", (e) => { e.preventDefault(); showViewPage("privacy"); });
  on("linkTerms", "click", (e) => { e.preventDefault(); showViewPage("terms"); });
  on("linkSupport", "click", (e) => { e.preventDefault(); showViewPage("support"); });
  on("btnBack", "click", showViewAuth);

  on("toastClose", "click", () => $("toast").classList.remove("show"));

  on("toggleLoginPass", "click", () => togglePassword("loginPass", "toggleLoginPass"));
  on("toggleRegPass", "click", () => togglePassword("regPass", "toggleRegPass"));

  on("regenCaptcha", "click", generateCaptcha);
  on("regPass", "input", updateStrength);
  on("personType", "change", updateDocLabel);

  on("btnNextStep", "click", () => {
    if (validateStep1()) setRegStep(2);
  });

  on("btnPrevStep", "click", () => setRegStep(1));

  const savedLang = localStorage.getItem("thekaden_lang") || "pt";
  if (savedLang === "en") {
    $("btnUS").setAttribute("aria-pressed", "true");
    $("btnBR").setAttribute("aria-pressed", "false");
    applyLang("en");
  } else {
    $("btnBR").setAttribute("aria-pressed", "true");
    $("btnUS").setAttribute("aria-pressed", "false");
    applyLang("pt");
  }

  const remembered = localStorage.getItem("thekaden_remember") === "1";
  $("remember").checked = remembered;
  const lastUser = localStorage.getItem("thekaden_last_user");
  if (remembered && lastUser) $("loginUser").value = lastUser;

  showLogin();
  requestAnimationFrame(() => movePill($("tabLogin")));
  generateCaptcha();
  updateStrength();
  updateDocLabel();

  // --------------------------
  // LOGIN /api/login
  // --------------------------
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = T[lang];

    const user = $("loginUser");
    const pass = $("loginPass");

    const userVal = user.value.trim();
    const passVal = pass.value;

    const okUser = userVal.length >= 3;
    const okPass = String(passVal).trim().length >= 6;

    setInvalid(user, !okUser);
    setInvalid(pass, !okPass);

    if (!okUser) { toast(t.toasts.userBad, true); user.focus(); return; }
    if (!okPass) { toast(t.toasts.passWeak, true); pass.focus(); return; }

    // backend aceita email ou username aqui (server.js usa OR email/username)
    const loginPayload = { email: userVal, password: passVal };

    try {
      const r = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginPayload)
      });

      const data = await safeJson(r);

      if (!r.ok) {
        toast(data.error || t.toasts.serverError, true);
        return;
      }

      // ✅ salva token e manda pra home
      if (data?.token) {
        localStorage.setItem("thekaden_token", data.token);
      }

      const remember = $("remember").checked;
      localStorage.setItem("thekaden_remember", remember ? "1" : "0");
      if (remember) localStorage.setItem("thekaden_last_user", userVal);
      else localStorage.removeItem("thekaden_last_user");

      toast(t.toasts.loginOk, false);

      // ✅ redireciona
      setTimeout(() => {
        window.location.href = "home.html";
      }, 300);

    } catch (err) {
      console.error("LOGIN FETCH ERROR:", err);
      toast(t.toasts.apiDown, true);
    }
  });

  // --------------------------
  // REGISTER /api/register
  // --------------------------
  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = T[lang];

    if (regStep === 1) {
      if (validateStep1()) setRegStep(2);
      return;
    }

    const username = $("regUser");
    const name = $("regName");
    const email = $("regEmail");
    const pass = $("regPass");
    const pass2 = $("regPass2");
    const captcha = $("captchaAnswer");
    const agree = $("agree");

    const u = username.value.trim();
    const n = name.value.trim();
    const em = email.value.trim();
    const p = pass.value;
    const p2 = pass2.value;
    const cap = Number(String(captcha.value).trim());

    const okUser = validateUsername(u);
    const okName = n.length >= 2;
    const okEmail = validateEmail(em);
    const okPass = scorePassword(p) >= 2;
    const okMatch = p === p2;
    const okCaptcha = cap === captchaValue;
    const okAgree = agree.checked;

    setInvalid(username, !okUser);
    setInvalid(name, !okName);
    setInvalid(email, !okEmail);
    setInvalid(pass, !okPass);
    setInvalid(pass2, !okMatch);
    setInvalid(captcha, !okCaptcha);

    if (!okUser) { toast(t.toasts.userBad, true); username.focus(); return; }
    if (!okEmail) { toast(t.toasts.emailBad, true); email.focus(); return; }
    if (!okPass) { toast(t.toasts.passWeak, true); pass.focus(); return; }
    if (!okMatch) { toast(t.toasts.passNoMatch, true); pass2.focus(); return; }
    if (!okCaptcha) { toast(t.toasts.captchaBad, true); generateCaptcha(); captcha.focus(); return; }
    if (!okAgree) { toast(t.toasts.agree, true); return; }

    const payload = {
      username: u,
      email: em,
      password: p
    };

    try {
      const r = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(r);

      if (!r.ok) {
        const msg = data.error || (r.status === 409 ? t.toasts.duplicated : t.toasts.serverError);
        toast(msg, true);
        return;
      }

      toast(t.toasts.registerOk, false);

      $("loginUser").value = em;
      showLogin();
    } catch (err) {
      console.error("REGISTER FETCH ERROR:", err);
      toast(t.toasts.apiDown, true);
    }
  });
});
