// =============== DOM handles ===============
const chatForm   = document.getElementById("chatForm");
const userInput  = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const grid       = document.getElementById("catalogGrid");
const selectedUl = document.getElementById("selectedList");
const searchBox  = document.getElementById("searchInput");
const categoryEl = document.getElementById("categoryFilter");
const showMore   = document.getElementById("showMoreBtn");
const clearBtn   = document.getElementById("clearSelectedBtn");
const generateBtn= document.getElementById("generateBtn");
const lastQLabel = document.getElementById("lastQuestion");
const rtlToggle  = document.getElementById("rtlToggle");
const routineNotes = document.getElementById("routineNotes");

// =============== IMPORTANT: Worker URL ===============
// This is the ONLY line you would ever change if you made a new Worker.
const WORKER_URL = "https://silent-brook-0fad.blades79.workers.dev";

// =============== System Prompt (brand guardrails) ===============
const SYSTEM_PROMPT = `
You are the official L’Oréal Beauty Assistant.
You help users browse products, understand ingredients, and build routines.
Only discuss L’Oréal brands & beauty topics (skincare, makeup, haircare, fragrance).
If asked anything unrelated, reply: "I'm here to help with beauty — ask me about products, routines, or recommendations!"
Keep answers concise and friendly; ask follow-up questions when helpful.
`;

// =============== Minimal product dataset (example set) ===============
// You can expand this later; the UI and rubric features already work with this set.
const PRODUCTS = [
  // skincare
  {id:"cv-cleanser",   name:"CeraVe Foaming Facial Cleanser",  cat:"skincare",    img:"https://images.ctfassets.net/oggad6svuzkv/5a2lQxkA0S4WJtnQXGk9oj/d5fb41a6e2b67e553e1a7f2b7d1d7185/cerave-foaming-cleanser.png",  desc:"Gentle daily foaming cleanser for normal to oily skin.", price:"$13"},
  {id:"cv-spf",        name:"CeraVe AM Facial Moisturizing Lotion SPF 30", cat:"skincare", img:"https://images.ctfassets.net/oggad6svuzkv/3nqJ2c0x5Zc9k3IcL2kX6M/5b6980c37a2f2ae2e5b670e3a18e42a6/cerave-am-spf30.png", desc:"Lightweight morning moisturizer with sunscreen.", price:"$18"},
  {id:"lr-vitc",       name:"L’Oréal Revitalift Vitamin C Serum",          cat:"skincare", img:"https://lorealparisusa.com/cdn/shop/files/071249430466_1.jpg?v=171", desc:"Brightening serum with Vitamin C to help even tone.", price:"$28"},
  // haircare
  {id:"lp-purple",     name:"L’Oréal EverPure Purple Shampoo", cat:"haircare", img:"https://lorealparisusa.com/cdn/shop/files/071249343353_1.jpg?v=171", desc:"Tones brassiness for blonde, silver, or highlighted hair.", price:"$10"},
  {id:"lp-dream",      name:"Elvive Dream Lengths Conditioner", cat:"haircare", img:"https://lorealparisusa.com/cdn/shop/files/071249625954_1.jpg?v=171", desc:"Helps visibly reduce damage and nourish long hair.", price:"$8"},
  // makeup
  {id:"lp-true-m",     name:"True Match Super-Blendable Foundation", cat:"makeup", img:"https://lorealparisusa.com/cdn/shop/files/071249626395_1.jpg?v=171", desc:"Buildable foundation designed to match undertones.", price:"$13"},
  {id:"lp-lash",       name:"Voluminous Lash Paradise Mascara", cat:"makeup", img:"https://lorealparisusa.com/cdn/shop/files/071249406706_1.jpg?v=171", desc:"Length + volume mascara with feather-soft feel.", price:"$12"},
  // fragrance (placeholder image)
  {id:"ysl-libre",     name:"YSL Libre Eau de Parfum",          cat:"fragrance", img:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Perfume_bottle.png/320px-Perfume_bottle.png", desc:"Floral lavender with orange blossom and vanilla.", price:"$95"}
];

// =============== State & Persistence ===============
let selected = JSON.parse(localStorage.getItem("selectedProducts")||"[]");
let messages = [{role:"system", content:SYSTEM_PROMPT}]; // conversation history

function persist(){
  localStorage.setItem("selectedProducts", JSON.stringify(selected));
}

// =============== UI Helpers ===============
function el(tag, cls, html){const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e;}
function msg(content, who="bot"){ const div=el("div",`msg ${who}`); div.textContent = content; chatWindow.appendChild(div); chatWindow.scrollTop = chatWindow.scrollHeight; }

// Initial
msg("👋 Hello! Pick a few products, then click Generate Routine.", "sys");

// Render catalog (with search/filter/pagination)
let sliceEnd = 6;
function renderCatalog(){
  const term = (searchBox.value||"").toLowerCase();
  const cat = categoryEl.value;
  grid.innerHTML = "";
  const filtered = PRODUCTS.filter(p=>{
    const okCat = (cat==="all"||p.cat===cat);
    const okTxt = p.name.toLowerCase().includes(term);
    return okCat && okTxt;
  }).slice(0, sliceEnd);

  filtered.forEach(p=>{
    const card = el("div","card"+(selected.find(s=>s.id===p.id)?" selected":""),`
      <header>
        <h3>${p.name}</h3>
        <span class="tag">${p.cat}</span>
      </header>
      <img src="${p.img}" alt="${p.name}">
      <div class="price">${p.price}</div>
      <div class="row">
        <button class="btn" data-action="toggle" data-id="${p.id}">${selected.find(s=>s.id===p.id)?"Remove":"Select"}</button>
        <button class="btn" data-action="reveal" data-id="${p.id}">Details</button>
      </div>
    `);
    // button actions
    card.addEventListener("click",(e)=>{
      const a = e.target.closest("button")?.dataset.action;
      if(!a) return;
      if(a==="toggle"){ toggleSelect(p); renderCatalog(); renderSelected(); }
      if(a==="reveal"){ openModal(p); }
    });
    grid.appendChild(card);
  });
  showMore.style.display = (sliceEnd < PRODUCTS.length && filtered.length===sliceEnd) ? "block":"none";
}

function renderSelected(){
  selectedUl.innerHTML = "";
  selected.forEach(p=>{
    const li = el("li","selected-item");
    li.innerHTML = `<button class="remove" aria-label="Remove">×</button><span>${p.name}</span>`;
    li.querySelector(".remove").onclick = ()=>{ selected = selected.filter(x=>x.id!==p.id); persist(); renderCatalog(); renderSelected(); };
    selectedUl.appendChild(li);
  });
}

function toggleSelect(p){
  if(selected.find(x=>x.id===p.id)){ selected = selected.filter(x=>x.id!==p.id); }
  else { selected.push(p); }
  persist();
}

function openModal(p){
  const dlg = document.getElementById("productModal");
  document.getElementById("modalTitle").textContent = p.name;
  document.getElementById("modalImg").src = p.img;
  document.getElementById("modalDesc").textContent = p.desc;
  dlg.showModal();
}
document.getElementById("modalClose").onclick = ()=>document.getElementById("productModal").close();

// =============== Events ===============
searchBox.addEventListener("input", ()=>{ sliceEnd=6; renderCatalog(); });
categoryEl.addEventListener("change", ()=>{ sliceEnd=6; renderCatalog(); });
showMore.addEventListener("click", ()=>{ sliceEnd += 6; renderCatalog(); });
clearBtn.addEventListener("click", ()=>{ selected=[]; persist(); renderCatalog(); renderSelected(); });

rtlToggle.addEventListener("change", ()=>{
  document.documentElement.dir = rtlToggle.checked ? "rtl" : "ltr";
});

// Generate Routine -> send selected to AI
generateBtn.addEventListener("click", async ()=>{
  if(selected.length===0){ msg("Select at least one product first.", "sys"); return; }

  const brief = selected.map(p=>`${p.name} (${p.cat})`).join("; ");
  const userTurn = `Please generate a simple, step-by-step beauty routine using these products: ${brief}. Include when to use each (AM/PM), and short tips.`;

  lastQLabel.textContent = userTurn;
  messages.push({role:"user", content:userTurn});
  await sendToWorker(messages);
});

// Follow-up chat
chatForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const text = userInput.value.trim();
  if(!text) return;
  lastQLabel.textContent = text;
  msg(text,"user");
  userInput.value = "";
  messages.push({role:"user", content:text});
  await sendToWorker(messages);
});

// =============== Worker call ===============
async function sendToWorker(history){
  msg("Typing…","bot");
  try{
    // Our Worker expects {system, user} but we also want context.
    // We'll compress history into a single user turn for simplicity.
    const last = history.filter(m=>m.role==="user").slice(-1)[0]?.content || "";
    const context = `
Context:
Selected products: ${selected.map(p=>p.name).join(", ")||"none"}
Conversation so far (most recent user message last):
${history.filter(m=>m.role!=="system").map(m=>`${m.role.toUpperCase()}: ${m.content}`).join("\n").slice(-1200)}
Answer concisely as L’Oréal Beauty Assistant. 
`;
    const res = await fetch(WORKER_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        system: SYSTEM_PROMPT + "\n" + context,
        user: last
      })
    });
    const data = await res.json();
    const lastMsg = chatWindow.querySelector(".msg.bot:last-child");
    if(lastMsg) lastMsg.remove();
    msg(data.response || "No response.", "bot");
  }catch(err){
    const lastMsg = chatWindow.querySelector(".msg.bot:last-child");
    if(lastMsg) lastMsg.remove();
    msg("⚠️ Network error. Check your Worker URL and that your OPENAI_KEY is set.", "bot");
    console.error(err);
  }
}

// =============== Kickoff ===============
renderCatalog();
renderSelected();
