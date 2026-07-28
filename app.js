(() => {
'use strict';
  const KEY='nuestroEspacio_v1';
  const money = n => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',minimumFractionDigits:2}).format(Number(n||0));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
  const esc = s => String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const UNITS=['kg','g','L','ml','unidades','rebanadas','porciones','paquetes','bolsas','botellas','cajas','bandejas','atados','latas','frascos','docenas','juegos','rollos','barras','sobres','pares'];
  const CATEGORY_OPTIONS=[...new Set(window.NE_PRODUCTS.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'es'));
  const normalizeText=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  const seed = {
    version:1,
    settings:{theme:'light',marketBudget:500,partnerA:'Marcos',partnerB:'Pareja',peopleCount:2,antExpenseEstimate:80,currency:'PEN',country:'PE',catalogUpdated:'2026-07'},
    incomes:[
      {id:uid(),person:'Marcos',type:'Sueldo',amount:500,period:'Q1',date:todayISO(),active:true},
      {id:uid(),person:'Marcos',type:'Sueldo',amount:900,period:'Q2',date:todayISO(),active:true},
      {id:uid(),person:'Pareja',type:'Bono',amount:150,period:'Q2',date:todayISO(),active:true}
    ],
    expenses:[
      {id:uid(),name:'Alquiler',amount:650,category:'Fijos',period:'Q2',date:todayISO(),note:'Pago de casa'},
      {id:uid(),name:'Pasajes',amount:90,category:'Diarios',period:'Q1',date:todayISO(),note:'Trabajo'},
      {id:uid(),name:'Café y snacks',amount:24.5,category:'Hormiga',period:'Q1',date:todayISO(),note:''}
    ],
    products: window.NE_PRODUCTS.map(p => ({...p})),
    cart:[
      {id:uid(),productName:'Tomate',productId:null,category:'Verduras y hortalizas',qty:1.5,unit:'kg',price:4.8,store:'market',done:false,date:todayISO()},
      {id:uid(),productName:'Arroz',productId:null,category:'Arroz y cereales',qty:5,unit:'kg',price:4.5,store:'market',done:false,date:todayISO()},
      {id:uid(),productName:'Leche',productId:null,category:'Lácteos',qty:2,unit:'L',price:5.2,store:'supermarket',done:true,actualTotal:9.8,date:todayISO()}
    ],
    pantry:[
      {id:uid(),productName:'Arroz',category:'Arroz y cereales',qty:2,unit:'kg',min:1,dailyUse:.12,expiry:'',conversion:1,purchaseUnit:'kg'},
      {id:uid(),productName:'Leche',category:'Lácteos',qty:1,unit:'L',min:2,dailyUse:.25,expiry:new Date(Date.now()+4*864e5).toISOString().slice(0,10),conversion:1,purchaseUnit:'L'},
      {id:uid(),productName:'Limón',category:'Cítricos',qty:7,unit:'unidades',min:5,dailyUse:1,expiry:'',conversion:18,purchaseUnit:'kg'}
    ],
    recipeFavorites:[],
    tasks:[
      {id:uid(),title:'Pagar internet',type:'Tarea',assigned:'Ambos',due:todayISO(),done:false,priority:'Alta'},
      {id:uid(),title:'Comprar foco para la sala',type:'Compra general',assigned:'Marcos',due:'',done:false,priority:'Media'},
      {id:uid(),title:'Limpiar refrigeradora',type:'Tarea',assigned:'Pareja',due:'',done:true,priority:'Baja'}
    ]
  };

  let state = load();
  let currentView='dashboard';
  let chartExpense=null, chartPeriods=null;

  function load(){
    try {
      const saved=JSON.parse(localStorage.getItem(KEY));
      const s=saved && saved.settings ? saved : structuredClone(seed);
      s.settings={...seed.settings,...(s.settings||{}),currency:'PEN',country:'PE',peopleCount:Math.max(1,Number(s.settings?.peopleCount||2))};
      s.recipeFavorites=Array.isArray(s.recipeFavorites)?s.recipeFavorites:[];
      s.products=Array.isArray(s.products)?s.products:[];
      const byName=new Map(s.products.map(p=>[normalizeText(p.name),p]));
      window.NE_PRODUCTS.forEach(master=>{
        const current=byName.get(normalizeText(master.name));
        if(current){
          current.category=current.category||master.category;
          current.unit=current.unit||master.unit;
          current.pantryUnit=current.pantryUnit||master.pantryUnit;
          current.conversion=Number(current.conversion||master.conversion||1);
          current.market=Number(current.market||master.market||0);
          current.supermarket=Number(current.supermarket||master.supermarket||0);
          current.wholesale=Number(current.wholesale||master.wholesale||0);
          if(master.packageSize){ current.packageSize=Number(master.packageSize); current.packageUnit=master.packageUnit; }
        } else s.products.push({...master});
      });
      // Migración v2.1: corrige equivalencias antiguas que provocaban kg/latas/paquetes exagerados en recetas.
      const forceMaster=['ají amarillo','leche evaporada','pan de molde'];
      forceMaster.forEach(name=>{
        const master=window.NE_PRODUCTS.find(p=>normalizeText(p.name)===name);
        const current=s.products.find(p=>normalizeText(p.name)===name);
        if(master&&current){
          current.unit=master.unit; current.pantryUnit=master.pantryUnit;
          current.conversion=Number(master.conversion||1);
          if(master.packageSize){current.packageSize=Number(master.packageSize);current.packageUnit=master.packageUnit;}
        }
      });
      (s.pantry||[]).forEach(item=>{
        const n=normalizeText(item.productName);
        if(n==='aji amarillo'&&item.unit==='kg'){item.qty=Number(item.qty||0)*10;item.min=Number(item.min||0)*10;item.dailyUse=Number(item.dailyUse||0)*10;item.unit='unidades';item.purchaseUnit='kg';item.conversion=10;}
        if(n==='leche evaporada'&&['lata','latas'].includes(item.unit)){item.qty=Number(item.qty||0)*400;item.min=Number(item.min||0)*400;item.dailyUse=Number(item.dailyUse||0)*400;item.unit='ml';item.purchaseUnit='lata';item.conversion=400;}
        if(n==='pan de molde'&&['paquete','paquetes'].includes(item.unit)){item.qty=Number(item.qty||0)*20;item.min=Number(item.min||0)*20;item.dailyUse=Number(item.dailyUse||0)*20;item.unit='rebanadas';item.purchaseUnit='paquete';item.conversion=20;}
      });
      s.version=Math.max(2.1,Number(s.version||1));
      return s;
    } catch { return structuredClone(seed); }
  }
  function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
  function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.add('hidden'),2400); }
  function icon(){ lucide.createIcons(); }
  function modal(title,html){ document.getElementById('modalTitle').textContent=title; document.getElementById('modalBody').innerHTML=html; document.getElementById('modal').classList.add('open'); icon(); }
  function closeModal(){ document.getElementById('modal').classList.remove('open'); }

  function totals(){
    const inc=state.incomes.filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount),0);
    const exp=state.expenses.reduce((s,x)=>s+Number(x.amount),0);
    const pending=state.cart.filter(x=>!x.done).reduce((s,x)=>s+Number(x.qty)*Number(x.price),0);
    const bought=state.cart.filter(x=>x.done).reduce((s,x)=>s+Number(x.actualTotal ?? x.qty*x.price),0);
    const fixed=state.expenses.filter(x=>x.category==='Fijos').reduce((s,x)=>s+Number(x.amount),0);
    const ants=state.expenses.filter(x=>x.category==='Hormiga').reduce((s,x)=>s+Number(x.amount),0);
    return {inc,exp,pending,bought,fixed,ants,projected:inc-exp-pending-state.settings.antExpenseEstimate};
  }
  function periodTotals(period){
    const inc=state.incomes.filter(x=>x.period===period&&x.active!==false).reduce((s,x)=>s+Number(x.amount),0);
    const exp=state.expenses.filter(x=>x.period===period).reduce((s,x)=>s+Number(x.amount),0);
    return {inc,exp,balance:inc-exp};
  }
  function card(title,value,sub,accent='slate',iconName='circle-dollar-sign'){
    const colors={emerald:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',blue:'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',indigo:'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',amber:'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',slate:'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'};
    return `<article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex items-start justify-between gap-3"><div><p class="text-xs text-slate-500 dark:text-zinc-400">${esc(title)}</p><p class="mt-1 text-2xl font-semibold tracking-tight">${esc(value)}</p><p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">${esc(sub)}</p></div><div class="w-10 h-10 rounded-xl grid place-items-center ${colors[accent]}"><i data-lucide="${iconName}" class="w-5 h-5"></i></div></div></article>`;
  }

  function renderDashboard(){
    const t=totals(); const low=state.pantry.filter(x=>Number(x.qty)<=Number(x.min)).length; const pendingTasks=state.tasks.filter(x=>!x.done).length;
    const advice=advisor();
    document.getElementById('dashboard').innerHTML=`
      <div class="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Resumen del hogar</p><h2 class="text-3xl font-semibold tracking-tight">Todo bajo control</h2></div><button data-action="quick-summary" class="rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-sm hover:bg-white dark:hover:bg-zinc-900"><i data-lucide="sparkles" class="inline w-4 h-4 mr-2"></i>Ver análisis</button></div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">${card('Ingresos del mes',money(t.inc),'Sueldo + bonos','emerald','badge-euro')}${card('Gastos registrados',money(t.exp),'Sin incluir pendientes','amber','receipt-text')}${card('Mercado pendiente',money(t.pending),`${state.cart.filter(x=>!x.done).length} productos`,'blue','shopping-basket')}${card('Saldo proyectado',money(t.projected),'Después de fijos, carrito y hormiga','indigo','chart-no-axes-combined')}</div>
      <div class="grid lg:grid-cols-3 gap-4 mt-4">
        <article class="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex items-center justify-between"><div><p class="text-sm font-medium">Distribución de gastos</p><p class="text-xs text-slate-500 dark:text-zinc-400">Por categoría</p></div><button data-view-jump="finanzas" class="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">Abrir finanzas</button></div><div class="h-64 mt-4"><canvas id="expenseChart"></canvas></div></article>
        <article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex items-center justify-between"><p class="text-sm font-medium">Estado rápido</p><i data-lucide="activity" class="w-4 h-4 text-slate-400"></i></div><div class="mt-4 space-y-3">${statusRow('Despensa',`${low} por reponer`,low?'amber':'emerald','package-open')}${statusRow('Tareas',`${pendingTasks} pendientes`,pendingTasks?'indigo':'emerald','check-square-2')}${statusRow('Mercado',`${state.cart.filter(x=>!x.done).length} pendientes`,'blue','shopping-cart')}${statusRow('Comprado',money(t.bought),'emerald','badge-check')}${statusRow('Hogar',`${state.settings.peopleCount} personas`,'indigo','users-round')}</div></article>
      </div>
      <article class="mt-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 shadow-soft"><div class="flex gap-3"><div class="w-10 h-10 rounded-xl bg-white/10 grid place-items-center shrink-0"><i data-lucide="brain-circuit" class="w-5 h-5"></i></div><div><p class="font-medium">AI Expense Advisor</p><p class="mt-1 text-sm text-slate-200">${esc(advice[0])}</p><div class="mt-3 flex flex-wrap gap-2">${advice.slice(1).map(a=>`<span class="text-xs bg-white/10 rounded-full px-3 py-1">${esc(a)}</span>`).join('')}</div></div></div></article>`;
    renderExpenseChart();
  }
  function statusRow(label,value,color,ico){ const c={amber:'text-amber-600 dark:text-amber-300',emerald:'text-emerald-600 dark:text-emerald-300',blue:'text-blue-600 dark:text-blue-300',indigo:'text-indigo-600 dark:text-indigo-300'}[color]; return `<div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70"><i data-lucide="${ico}" class="w-4 h-4 ${c}"></i><div class="flex-1"><p class="text-xs text-slate-500 dark:text-zinc-400">${label}</p><p class="text-sm font-medium">${value}</p></div></div>`; }
  function renderExpenseChart(){
    const by={}; state.expenses.forEach(x=>by[x.category]=(by[x.category]||0)+Number(x.amount));
    const ctx=document.getElementById('expenseChart'); if(!ctx)return; chartExpense?.destroy(); chartExpense=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(by),datasets:[{data:Object.values(by),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8}}}}});
  }

  function renderFinances(){
    const t=totals(), q1=periodTotals('Q1'), q2=periodTotals('Q2');
    document.getElementById('finanzas').innerHTML=`
      <div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Ingresos y gastos</p><h2 class="text-3xl font-semibold">Finanzas</h2></div><div class="flex gap-2"><button data-action="add-income" class="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Ingreso</button><button data-action="add-expense" class="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Gasto</button></div></div>
      <div class="grid md:grid-cols-2 gap-4"><periodCard('1ra Quincena',q1,'Q1')><periodCard('Fin de mes',q2,'Q2')></div>
      <div class="grid lg:grid-cols-5 gap-4 mt-4">
        <article class="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p class="font-medium">Historial financiero</p><p class="text-xs text-slate-500 dark:text-zinc-400">Busca y filtra movimientos</p></div><div class="flex gap-2"><input id="financeSearch" placeholder="Buscar..." class="w-full sm:w-44 rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"><select id="financeFilter" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"><option>Todos</option><option>Ingresos</option><option>Gastos</option></select></div></div><div id="financeList" class="mt-4 space-y-2"></div></article>
        <article class="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><p class="font-medium">Comparación quincenal</p><div class="h-64 mt-4"><canvas id="periodChart"></canvas></div><div class="mt-3 text-sm text-slate-500 dark:text-zinc-400">Proyección general: <strong class="text-slate-900 dark:text-white">${money(t.projected)}</strong></div></article>
      </div>`;
    renderFinanceList(); renderPeriodChart();
  }
  function periodCard(title,p,period){ const pct=p.inc?Math.min(100,(p.exp/p.inc)*100):100; return `<article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-soft"><div class="flex items-center justify-between"><div><p class="text-sm text-slate-500 dark:text-zinc-400">${title}</p><p class="text-2xl font-semibold mt-1 ${p.balance<0?'text-rose-600':'text-emerald-600'}">${money(p.balance)}</p></div><span class="text-xs rounded-full px-3 py-1 bg-slate-100 dark:bg-zinc-800">${period}</span></div><div class="grid grid-cols-2 gap-3 mt-4 text-sm"><div><p class="text-slate-500">Ingresos</p><p class="font-medium">${money(p.inc)}</p></div><div><p class="text-slate-500">Gastos</p><p class="font-medium">${money(p.exp)}</p></div></div><div class="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 mt-4 overflow-hidden"><div class="progress h-full rounded-full ${pct>90?'bg-rose-500':pct>70?'bg-amber-500':'bg-emerald-500'}" style="width:${pct}%"></div></div></article>`; }
  function financeRows(){ return [...state.incomes.map(x=>({...x,kind:'Ingreso',name:`${x.type} · ${x.person}`})),...state.expenses.map(x=>({...x,kind:'Gasto'}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))); }
  function renderFinanceList(){ const q=(document.getElementById('financeSearch')?.value||'').toLowerCase(), f=document.getElementById('financeFilter')?.value||'Todos'; const rows=financeRows().filter(x=>(f==='Todos'||f===x.kind+'s')&&(`${x.name} ${x.category||''} ${x.note||''}`.toLowerCase().includes(q))); const el=document.getElementById('financeList'); if(!el)return; el.innerHTML=rows.length?rows.map(x=>`<div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70"><div class="w-9 h-9 rounded-xl grid place-items-center ${x.kind==='Ingreso'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50':'bg-rose-100 text-rose-700 dark:bg-rose-950/50'}"><i data-lucide="${x.kind==='Ingreso'?'arrow-down-left':'arrow-up-right'}" class="w-4 h-4"></i></div><div class="min-w-0 flex-1"><p class="text-sm font-medium truncate">${esc(x.name)}</p><p class="text-xs text-slate-500 dark:text-zinc-400">${esc(x.category||x.period||'')} · ${esc(x.date||'')}</p></div><p class="text-sm font-semibold ${x.kind==='Ingreso'?'text-emerald-600':'text-rose-600'}">${x.kind==='Ingreso'?'+':'-'}${money(x.amount)}</p><button data-edit-finance="${x.kind}:${x.id}" class="p-2 text-slate-400"><i data-lucide="pencil" class="w-4 h-4"></i></button></div>`).join(''):`<p class="text-sm text-slate-500 py-8 text-center">Sin movimientos.</p>`; icon(); }
  function renderPeriodChart(){ const q1=periodTotals('Q1'),q2=periodTotals('Q2'),ctx=document.getElementById('periodChart'); if(!ctx)return; chartPeriods?.destroy(); chartPeriods=new Chart(ctx,{type:'bar',data:{labels:['1ra Quincena','Fin de mes'],datasets:[{label:'Ingresos',data:[q1.inc,q2.inc]},{label:'Gastos',data:[q1.exp,q2.exp]}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},plugins:{legend:{position:'bottom'}}}}); }

  function renderMarket(){
    const pending=state.cart.filter(x=>!x.done), total=pending.reduce((s,x)=>s+x.qty*x.price,0), categories=[...new Set(state.cart.map(x=>x.category))];
    document.getElementById('mercado').innerHTML=`
      <div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Lista y proyección</p><h2 class="text-3xl font-semibold">Mercado</h2></div><button data-action="add-cart" class="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Producto</button></div>
      <div class="grid sm:grid-cols-3 gap-3">${card('Presupuesto',money(state.settings.marketBudget),'Editable en configuración','blue','landmark')}${card('Pendiente estimado',money(total),`${pending.length} productos`,'amber','calculator')}${card('Saldo proyectado',money(state.settings.marketBudget-total),'Después de comprar lo pendiente',state.settings.marketBudget-total<0?'amber':'emerald','piggy-bank')}</div>
      <div class="mt-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex flex-col md:flex-row gap-3 md:items-center justify-between"><div class="flex gap-2 overflow-auto scrollbar-hide">${['Todos',...categories].map((c,i)=>`<button class="market-cat shrink-0 px-3 py-2 rounded-xl text-sm ${i===0?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'bg-slate-100 dark:bg-zinc-800'}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="flex gap-2"><button data-action="share-cart" class="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm"><i data-lucide="share-2" class="inline w-4 h-4 mr-1"></i>Compartir</button><select id="marketStatus" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"><option value="pending">Pendientes</option><option value="all">Todos</option><option value="done">Comprados</option></select></div></div><div id="cartList" class="mt-4 space-y-3"></div></div>`;
    renderCart('Todos');
  }
  function renderCart(cat='Todos'){
    const status=document.getElementById('marketStatus')?.value||'pending'; let items=state.cart.filter(x=>(cat==='Todos'||x.category===cat)&&(status==='all'||(status==='done'?x.done:!x.done)));
    const groups={}; items.forEach(x=>(groups[x.category]??=[]).push(x)); const el=document.getElementById('cartList'); if(!el)return;
    el.innerHTML=items.length?Object.entries(groups).map(([c,arr])=>`<section><div class="flex items-center justify-between mb-2"><h3 class="text-sm font-semibold">${esc(c)}</h3><span class="text-xs text-slate-500">${arr.length} ítems · ${money(arr.reduce((s,x)=>s+(x.done?(x.actualTotal??x.qty*x.price):x.qty*x.price),0))}</span></div><div class="space-y-2">${arr.map(x=>`<article class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 ${x.done?'bg-emerald-50/60 dark:bg-emerald-950/20':'bg-slate-50 dark:bg-zinc-800/60'}"><button data-toggle-cart="${x.id}" class="w-6 h-6 rounded-lg border ${x.done?'bg-emerald-600 border-emerald-600 text-white':'border-slate-300 dark:border-zinc-600'} grid place-items-center">${x.done?'<i data-lucide="check" class="w-4 h-4"></i>':''}</button><div class="flex-1 min-w-0"><p class="font-medium ${x.done?'line-through text-slate-500':''}">${esc(x.productName)}</p><p class="text-xs text-slate-500 dark:text-zinc-400">${fmtQty(Number(x.qty))} ${esc(x.unit)} · ${money(x.price)} / ${esc(x.unit)}${x.conversionNote?`<span class="block mt-1 text-[11px] text-blue-600 dark:text-blue-300">${esc(x.conversionNote)}</span>`:''}</p></div><p class="font-semibold text-sm">${money(x.done?(x.actualTotal??x.qty*x.price):x.qty*x.price)}</p><button data-edit-cart="${x.id}" class="p-2 text-slate-400"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-delete-cart="${x.id}" class="p-2 text-rose-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></article>`).join('')}</div></section>`).join(''):`<p class="text-sm text-slate-500 py-10 text-center">No hay productos en esta vista.</p>`; icon();
  }

  function renderPantry(){
    const low=state.pantry.filter(x=>Number(x.qty)<=Number(x.min)).length;
    document.getElementById('despensa').innerHTML=`<div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Inventario doméstico</p><h2 class="text-3xl font-semibold">Despensa</h2></div><button data-action="add-pantry" class="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Producto</button></div><div class="grid sm:grid-cols-3 gap-3">${card('Productos',state.pantry.length,'Registrados','blue','package')}${card('Por reponer',low,'Stock bajo o agotado',low?'amber':'emerald','triangle-alert')}${card('Vencen pronto',state.pantry.filter(expiringSoon).length,'Próximos 7 días','amber','calendar-clock')}</div><div class="mt-4 flex gap-2"><input id="pantrySearch" placeholder="Buscar en despensa..." class="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"><select id="pantryFilter" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3 text-sm"><option value="all">Todos</option><option value="low">Por reponer</option><option value="exp">Vence pronto</option></select></div><div id="pantryList" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4"></div>`; renderPantryList();
  }
  function expiringSoon(x){ if(!x.expiry)return false; const d=(new Date(x.expiry)-new Date())/864e5; return d>=0&&d<=7; }
  function renderPantryList(){ const q=(document.getElementById('pantrySearch')?.value||'').toLowerCase(),f=document.getElementById('pantryFilter')?.value||'all'; const list=state.pantry.filter(x=>x.productName.toLowerCase().includes(q)&&(f==='all'||(f==='low'&&x.qty<=x.min)||(f==='exp'&&expiringSoon(x)))); const el=document.getElementById('pantryList'); if(!el)return; el.innerHTML=list.length?list.map(x=>{const ratio=x.min?Math.min(100,(x.qty/(x.min*2))*100):100, days=x.dailyUse?Math.floor(x.qty/(x.dailyUse*Math.max(1,Number(state.settings.peopleCount||1)))):null, low=x.qty<=x.min; return `<article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex items-start justify-between"><div><p class="font-semibold">${esc(x.productName)}</p><p class="text-xs text-slate-500">${esc(x.category)} · ${x.qty} ${esc(x.unit)}</p></div><span class="text-xs px-2 py-1 rounded-full ${low?'bg-rose-100 text-rose-700 dark:bg-rose-950/50':'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50'}">${low?'Reponer':'En stock'}</span></div><div class="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 mt-4 overflow-hidden"><div class="progress h-full rounded-full ${low?'bg-rose-500':ratio<60?'bg-amber-500':'bg-blue-500'}" style="width:${ratio}%"></div></div><div class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Mínimo: ${x.min} ${esc(x.unit)}</span><span>${days!==null?`Dura ~${days} días`:'Sin consumo diario'}</span><span>${x.expiry?`Vence: ${x.expiry}`:'Sin vencimiento'}</span><span>${x.purchaseUnit!==x.unit?`1 ${x.purchaseUnit} ≈ ${x.conversion} ${x.unit}`:'Misma unidad'}</span></div><div class="mt-4 flex gap-2"><button data-consume="${x.id}" class="flex-1 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-3 py-2 text-sm">Consumir</button><button data-reorder="${x.id}" class="rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-2 text-sm">Comprar</button><button data-edit-pantry="${x.id}" class="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2"><i data-lucide="pencil" class="w-4 h-4"></i></button></div></article>`}).join(''):`<p class="text-sm text-slate-500 py-10 text-center sm:col-span-2 xl:col-span-3">No hay productos.</p>`; icon(); }


  const DISCRETE_PURCHASE_UNITS=new Set(['unidad','unidades','paquete','paquetes','bolsa','bolsas','botella','botellas','caja','cajas','bandeja','bandejas','atado','atados','lata','latas','frasco','frascos','docena','docenas','juego','juegos','rollo','rollos','barra','barras','sobre','sobres','par','pares']);
  const PRODUCT_ALIASES={
    'arroz':'arroz extra','tomate':'tomate italiano','carne de res':'bistec','pollo':'pollo entero',
    'cebolla':'cebolla roja','papa':'papa blanca','leche':'leche evaporada','pan':'pan de molde',
    'aceite':'aceite vegetal','frejoles':'frejol canario','frijoles':'frejol canario'
  };
  function productFor(name){
    const normalized=normalizeText(name);
    const target=PRODUCT_ALIASES[normalized]||normalized;
    return state.products.find(x=>normalizeText(x.name)===target)
      || state.products.find(x=>normalizeText(x.name).startsWith(`${target} `))
      || state.products.find(x=>normalizeText(x.name).includes(target));
  }
  function ingredientPurchasePlan(name,qty,unit,roundForPurchase=true){
    const p=productFor(name);
    if(!p)return {product:null,qty:Number(qty),unit,note:'Sin equivalencia del catálogo'};
    let converted=convertMeasure(qty,unit,p.unit);
    let note='';
    if(converted===null && p.packageSize && p.packageUnit){
      const content=convertMeasure(qty,unit,p.packageUnit);
      if(content!==null){converted=content/Number(p.packageSize);note=`1 ${p.unit} contiene aprox. ${p.packageSize} ${p.packageUnit}`;}
    }
    const pantryUnitCompatible = unit===p.pantryUnit
      || (unit==='unidades' && ['rebanadas','porciones'].includes(p.pantryUnit))
      || (p.pantryUnit==='unidades' && ['rebanadas','porciones'].includes(unit));
    if(converted===null && pantryUnitCompatible && Number(p.conversion||0)>0){
      converted=Number(qty)/Number(p.conversion);
      note=`1 ${p.unit} ≈ ${p.conversion} ${p.pantryUnit}`;
    }
    if(converted===null && p.unit===p.pantryUnit){converted=Number(qty);}
    if(converted===null)return {product:p,qty:Number(qty),unit,note:'Revisa la equivalencia manualmente'};
    if(roundForPurchase && DISCRETE_PURCHASE_UNITS.has(p.unit)) converted=Math.ceil(converted-1e-9);
    return {product:p,qty:Number(converted),unit:p.unit,note};
  }
  function recipeCost(recipe, servings=recipe.servings){
    const factor=servings/recipe.servings;
    return recipe.ingredients.reduce((sum,ing)=>{
      const plan=ingredientPurchasePlan(ing.name,ing.qty*factor,ing.unit,true);
      return sum+(plan.product?plan.qty*Number(plan.product.market||0):0);
    },0);
  }
  function pantryEquivalent(name, qty, unit){
    const item=state.pantry.find(x=>normalizeText(x.productName)===normalizeText(name));
    if(!item)return 0;
    const product=productFor(name);
    if(unit===item.unit)return Number(item.qty||0);
    const direct=convertMeasure(Number(item.qty||0),item.unit,unit);
    if(direct!==null)return direct;
    if(product && item.unit===product.pantryUnit && unit===product.unit) return Number(item.qty||0)/Number(product.conversion||1);
    if(product && item.unit===product.unit && unit===product.pantryUnit) return Number(item.qty||0)*Number(product.conversion||1);
    return 0;
  }
  function renderRecipes(){
    const regions=['Todas',...new Set(window.NE_RECIPES.map(r=>r.region))];
    document.getElementById('recetas').innerHTML=`<div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Cocina peruana escalable para tu hogar</p><h2 class="text-3xl font-semibold">Recetas del Perú</h2></div></div><div class="grid sm:grid-cols-[1fr_auto_auto] gap-2"><input id="recipeSearch" placeholder="Buscar plato, ciudad o ingrediente..." class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"><select id="recipeRegion" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3 text-sm">${regions.map(x=>`<option>${x}</option>`).join('')}</select><select id="recipePeople" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3 text-sm">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===state.settings.peopleCount?'selected':''}>${n} personas</option>`).join('')}</select></div><div class="mt-3 rounded-xl bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 px-4 py-3 text-sm">Las cantidades se ajustan automáticamente. Al agregar al mercado, la app descuenta lo disponible en despensa y consolida ingredientes repetidos.</div><div id="recipeList" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4"></div>`;
    renderRecipeList();
  }
  function renderRecipeList(){
    const q=normalizeText(document.getElementById('recipeSearch')?.value||'');
    const region=document.getElementById('recipeRegion')?.value||'Todas';
    const people=Number(document.getElementById('recipePeople')?.value||state.settings.peopleCount||2);
    const list=window.NE_RECIPES.filter(r=>(region==='Todas'||r.region===region)&&normalizeText(`${r.name} ${r.city} ${r.department} ${r.ingredients.map(i=>i.name).join(' ')}`).includes(q));
    const el=document.getElementById('recipeList'); if(!el)return;
    el.innerHTML=list.map(r=>{const fav=state.recipeFavorites.includes(r.id);return `<article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft"><div class="flex items-start justify-between gap-3"><div><p class="font-semibold">${esc(r.name)}</p><p class="text-xs text-slate-500">${esc(r.city)} · ${esc(r.department)} · ${esc(r.region)}</p></div><button data-fav-recipe="${r.id}" class="p-2 ${fav?'text-rose-500':'text-slate-400'}"><i data-lucide="heart" class="w-5 h-5 ${fav?'fill-current':''}"></i></button></div><div class="flex flex-wrap gap-2 mt-3 text-xs"><span class="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-1">${r.time} min</span><span class="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-1">${esc(r.difficulty)}</span><span class="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-1">~${money(recipeCost(r,people))}</span></div><p class="mt-3 text-sm text-slate-500 line-clamp-2">${r.ingredients.slice(0,5).map(i=>i.name).join(', ')}${r.ingredients.length>5?'…':''}</p><div class="mt-4 flex gap-2"><button data-view-recipe="${r.id}" data-servings="${people}" class="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm">Ver receta</button><button data-add-recipe="${r.id}" data-servings="${people}" class="flex-1 rounded-xl bg-indigo-600 text-white px-3 py-2 text-sm">Agregar faltantes</button></div></article>`}).join('')||`<p class="text-sm text-slate-500 py-10 text-center sm:col-span-2 xl:col-span-3">No se encontraron recetas.</p>`; icon();
  }
  function openRecipe(id,servings){
    const r=window.NE_RECIPES.find(x=>x.id===id); if(!r)return; const factor=servings/r.servings;
    const rows=r.ingredients.map(i=>{const need=i.qty*factor,have=pantryEquivalent(i.name,need,i.unit),missing=Math.max(0,need-have);return `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-zinc-800"><div><p class="text-sm font-medium">${esc(i.name)}</p><p class="text-xs text-slate-500">Necesitas ${fmtQty(need)} ${esc(i.unit)} · Tienes aprox. ${fmtQty(have)} ${esc(i.unit)}</p></div><span class="text-xs rounded-full px-2 py-1 ${missing>0?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}">${missing>0?`Falta ${fmtQty(missing)} ${i.unit}`:'Disponible'}</span></div>`}).join('');
    modal(r.name,`<div class="flex flex-wrap gap-2 text-xs mb-4"><span class="rounded-full bg-slate-100 dark:bg-zinc-800 px-3 py-1">${servings} personas</span><span class="rounded-full bg-slate-100 dark:bg-zinc-800 px-3 py-1">${r.time} min</span><span class="rounded-full bg-slate-100 dark:bg-zinc-800 px-3 py-1">${esc(r.city)}</span><span class="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1">Costo estimado ${money(recipeCost(r,servings))}</span></div><h3 class="font-semibold mb-2">Ingredientes</h3>${rows}<h3 class="font-semibold mt-5 mb-2">Preparación</h3><ol class="space-y-2 text-sm text-slate-600 dark:text-zinc-300">${r.steps.map((s,i)=>`<li class="flex gap-3"><span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center shrink-0 text-xs">${i+1}</span><span>${esc(s)}</span></li>`).join('')}</ol><button data-add-recipe="${r.id}" data-servings="${servings}" class="mt-5 w-full rounded-xl bg-indigo-600 text-white py-3 font-medium">Agregar ingredientes faltantes al mercado</button>`);
  }
  function fmtQty(n){return Number(n.toFixed(n<10?2:1)).toString()}
  function addRecipeToCart(id,servings){
    const r=window.NE_RECIPES.find(x=>x.id===id); if(!r)return;
    const factor=servings/r.servings; let added=0; const conversionNotes=[];
    r.ingredients.forEach(i=>{
      const need=i.qty*factor;
      const have=pantryEquivalent(i.name,need,i.unit);
      const missing=Math.max(0,need-have); if(missing<=0.001)return;
      const plan=ingredientPurchasePlan(i.name,missing,i.unit,true);
      const p=plan.product; const qty=plan.qty; const unit=plan.unit;
      const existing=state.cart.find(x=>!x.done&&normalizeText(x.productName)===normalizeText(i.name)&&x.unit===unit);
      if(existing) existing.qty=Number(existing.qty)+qty;
      else state.cart.push({id:uid(),productName:i.name,productId:p?.id||null,category:p?.category||'Otros',qty:Number(qty.toFixed(3)),unit,price:Number(p?.market||0),store:'market',done:false,date:todayISO(),recipeId:r.id,recipeSourceQty:missing,recipeSourceUnit:i.unit,conversionNote:plan.note});
      if(plan.note)conversionNotes.push(`${i.name}: ${fmtQty(missing)} ${i.unit} → ${fmtQty(qty)} ${unit}`);
      added++;
    });
    save();renderAll();closeModal();
    toast(added?`${added} ingredientes agregados correctamente`:'Ya tienes todos los ingredientes');
    if(conversionNotes.length) setTimeout(()=>modal('Conversiones aplicadas',`<div class="space-y-2">${conversionNotes.map(n=>`<div class="rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-2 text-sm">${esc(n)}</div>`).join('')}</div><p class="mt-4 text-xs text-slate-500 dark:text-zinc-400">Las presentaciones cerradas, como latas y paquetes, se redondean hacia arriba para que puedas comprarlas realmente.</p>`),350);
  }
  function renderSettings(){
    const fixed=state.expenses.filter(x=>x.category==='Fijos'); const salaries=state.incomes.filter(x=>x.type==='Sueldo');
    document.getElementById('configuracion').innerHTML=`<div class="mb-5"><p class="text-sm text-slate-500 dark:text-zinc-400">Personaliza cálculos y presupuesto</p><h2 class="text-3xl font-semibold">Configuración</h2></div><div class="grid lg:grid-cols-2 gap-4"><article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-soft"><div class="flex items-center justify-between"><div><p class="font-semibold">Hogar</p><p class="text-xs text-slate-500">Integrantes y parámetros generales</p></div><i data-lucide="users-round" class="w-5 h-5 text-indigo-500"></i></div><form id="settingsForm" class="grid sm:grid-cols-2 gap-4 mt-4">${input('Nombre integrante 1','partnerA',state.settings.partnerA,'text','required')}${input('Nombre integrante 2','partnerB',state.settings.partnerB,'text','required')}${input('Cantidad de personas','peopleCount',state.settings.peopleCount,'number','min="1" max="20" required')}${input('Presupuesto de mercado','marketBudget',state.settings.marketBudget,'number','step="0.01" min="0" required')}${input('Gasto hormiga estimado','antExpenseEstimate',state.settings.antExpenseEstimate,'number','step="0.01" min="0"')}<button class="sm:col-span-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 font-medium">Guardar configuración</button></form></article><article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-soft"><div class="flex items-center justify-between"><div><p class="font-semibold">Duración de despensa</p><p class="text-xs text-slate-500">Se calcula para ${state.settings.peopleCount} personas</p></div><i data-lucide="hourglass" class="w-5 h-5 text-blue-500"></i></div><p class="mt-4 text-sm text-slate-600 dark:text-zinc-300">El campo “consumo diario” de cada producto se interpreta por persona. La duración mostrada será:</p><div class="mt-3 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 p-3 text-sm">Stock ÷ (consumo diario por persona × ${state.settings.peopleCount} personas)</div><button data-view-jump="despensa" class="mt-4 rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm">Configurar productos</button></article></div><div class="grid lg:grid-cols-2 gap-4 mt-4"><article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-soft"><div class="flex justify-between items-center"><div><p class="font-semibold">Sueldos configurados</p><p class="text-xs text-slate-500">Editables por quincena</p></div><button data-action="add-income" class="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm">Añadir</button></div><div class="mt-4 space-y-2">${salaries.map(x=>`<button data-edit-finance="Ingreso:${x.id}" class="w-full flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 text-left"><span><strong>${esc(x.person)}</strong><small class="block text-slate-500">${x.period==='Q1'?'1ra quincena':'Fin de mes'}</small></span><strong>${money(x.amount)}</strong></button>`).join('')||'<p class="text-sm text-slate-500">No hay sueldos.</p>'}</div></article><article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-soft"><div class="flex justify-between items-center"><div><p class="font-semibold">Gastos fijos</p><p class="text-xs text-slate-500">Casa, servicios, pasajes y compromisos</p></div><button data-action="add-fixed-expense" class="rounded-xl bg-amber-600 text-white px-3 py-2 text-sm">Añadir</button></div><div class="mt-4 space-y-2">${fixed.map(x=>`<button data-edit-finance="Gasto:${x.id}" class="w-full flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 text-left"><span><strong>${esc(x.name)}</strong><small class="block text-slate-500">${x.period==='Q1'?'1ra quincena':'Fin de mes'}</small></span><strong>${money(x.amount)}</strong></button>`).join('')||'<p class="text-sm text-slate-500">No hay gastos fijos.</p>'}</div></article></div>`;
    document.getElementById('settingsForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));state.settings={...state.settings,...f,peopleCount:Math.max(1,Number(f.peopleCount)),marketBudget:Number(f.marketBudget),antExpenseEstimate:Number(f.antExpenseEstimate)};save();renderAll();toast('Configuración guardada');}; icon();
  }

  function renderTasks(){ document.getElementById('tareas').innerHTML=`<div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Pendientes compartidos</p><h2 class="text-3xl font-semibold">Tareas</h2></div><button data-action="add-task" class="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Nueva</button></div><div class="flex gap-2 overflow-auto scrollbar-hide">${['Todas','Pendientes','Completadas','Tarea','Compra general'].map((x,i)=>`<button class="task-filter shrink-0 rounded-xl px-3 py-2 text-sm ${i===0?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800'}" data-taskfilter="${x}">${x}</button>`).join('')}</div><div id="taskList" class="mt-4 space-y-2"></div>`; renderTaskList('Todas'); }
  function renderTaskList(filter){ let list=state.tasks.filter(x=>filter==='Todas'||(filter==='Pendientes'&&!x.done)||(filter==='Completadas'&&x.done)||x.type===filter); const el=document.getElementById('taskList'); el.innerHTML=list.length?list.map(x=>`<article class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"><button data-toggle-task="${x.id}" class="w-7 h-7 rounded-lg border ${x.done?'bg-indigo-600 border-indigo-600 text-white':'border-slate-300 dark:border-zinc-700'} grid place-items-center">${x.done?'<i data-lucide="check" class="w-4 h-4"></i>':''}</button><div class="flex-1 min-w-0"><p class="font-medium ${x.done?'line-through text-slate-500':''}">${esc(x.title)}</p><p class="text-xs text-slate-500">${esc(x.type)} · ${esc(x.assigned)} ${x.due?'· '+x.due:''}</p></div><span class="text-xs rounded-full px-2 py-1 ${x.priority==='Alta'?'bg-rose-100 text-rose-700':x.priority==='Media'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}">${x.priority}</span><button data-edit-task="${x.id}" class="p-2 text-slate-400"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-delete-task="${x.id}" class="p-2 text-rose-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></article>`).join(''):`<p class="text-sm text-slate-500 py-10 text-center">Sin tareas.</p>`; icon(); }

  function renderCatalog(){ const cats=[...new Set(state.products.map(x=>x.category))]; document.getElementById('catalogo').innerHTML=`<div class="flex items-end justify-between gap-3 mb-5"><div><p class="text-sm text-slate-500 dark:text-zinc-400">Catálogo maestro Perú · precios referenciales editables</p><h2 class="text-3xl font-semibold">Catálogo Perú</h2></div><button data-action="add-product" class="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm"><i data-lucide="plus" class="inline w-4 h-4 mr-1"></i>Producto</button></div><div class="flex gap-2"><input id="catalogSearch" placeholder="Buscar producto..." class="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"><select id="catalogFilter" class="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3 text-sm"><option>Todos</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">Precios promedio referenciales en soles para Lima, Perú. Pueden variar por distrito, temporada, marca, presentación y promociones. Todos son editables.</div><div id="catalogList" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4"></div>`; renderCatalogList(); }
  function renderCatalogList(){ const q=(document.getElementById('catalogSearch')?.value||'').toLowerCase(), f=document.getElementById('catalogFilter')?.value||'Todos'; const list=state.products.filter(x=>normalizeText(x.name).includes(normalizeText(q))&&(f==='Todos'||x.category===f)); const el=document.getElementById('catalogList'); el.innerHTML=list.map(x=>`<article class="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"><div class="flex items-start justify-between"><div><p class="font-semibold">${esc(x.name)}</p><p class="text-xs text-slate-500">${esc(x.category)} · ${esc(x.unit)}</p></div><div class="flex"><button data-edit-product="${x.id}" class="p-2 text-slate-400"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-delete-product="${x.id}" class="p-2 text-rose-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div><div class="grid grid-cols-3 gap-2 mt-4 text-center text-xs"><div class="rounded-xl bg-slate-50 dark:bg-zinc-800 p-2"><p class="text-slate-500">Mercado</p><p class="font-medium mt-1">${money(x.market)}</p></div><div class="rounded-xl bg-slate-50 dark:bg-zinc-800 p-2"><p class="text-slate-500">Super</p><p class="font-medium mt-1">${money(x.supermarket)}</p></div><div class="rounded-xl bg-slate-50 dark:bg-zinc-800 p-2"><p class="text-slate-500">Mayorista</p><p class="font-medium mt-1">${money(x.wholesale)}</p></div></div><p class="text-xs text-slate-500 mt-3">Despensa: ${esc(x.pantryUnit)} · Conversión: ${x.conversion} · Precios ref. Lima</p></article>`).join('')||`<p class="text-sm text-slate-500 py-10 text-center sm:col-span-2 xl:col-span-3">Sin productos.</p>`; icon(); }

  function advisor(){ const t=totals(); const pct=t.inc?Math.round((t.ants/t.inc)*100):0; const q1=periodTotals('Q1'),q2=periodTotals('Q2'); const a=[]; a.push(t.projected<0?`Alerta: la proyección general queda en ${money(t.projected)}.`:`La proyección general deja un margen de ${money(t.projected)}.`); a.push(`Gasto hormiga: ${pct}% de ingresos`); if(q1.balance<0)a.push(`1ra quincena desbalanceada por ${money(Math.abs(q1.balance))}`); if(q2.balance<0)a.push(`Fin de mes desbalanceado por ${money(Math.abs(q2.balance))}`); if(t.pending>state.settings.marketBudget)a.push('El carrito supera el presupuesto de mercado'); if(!a.slice(1).length)a.push('Presupuesto saludable'); return a; }

  function formWrap(fields,submitText='Guardar'){ return `<form id="modalForm" class="space-y-4">${fields}<button class="w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 font-medium">${submitText}</button></form>`; }
  const input=(label,name,val='',type='text',extra='')=>`<label class="block"><span class="text-sm text-slate-600 dark:text-zinc-300">${label}</span><input name="${name}" type="${type}" value="${esc(val)}" ${extra} class="mt-1 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-3"></label>`;
  const select=(label,name,opts,val='')=>`<label class="block"><span class="text-sm text-slate-600 dark:text-zinc-300">${label}</span><select name="${name}" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-3">${opts.map(o=>{const item=typeof o==='object'?o:{value:o,label:o};return `<option value="${esc(item.value)}" ${String(item.value)===String(val)?'selected':''}>${esc(item.label)}</option>`}).join('')}</select></label>`;

  function openIncome(id){ const x=state.incomes.find(i=>i.id===id)||{person:state.settings.partnerA,type:'Sueldo',amount:'',period:'Q1',date:todayISO(),active:true}; modal(id?'Editar ingreso':'Nuevo ingreso',formWrap(`<div class="grid sm:grid-cols-2 gap-4">${select('Integrante','person',[state.settings.partnerA,state.settings.partnerB],x.person)}${select('Tipo','type',['Sueldo','Bono','Ingreso extra'],x.type)}${input('Monto','amount',x.amount,'number','step="0.01" required')}${select('Periodo','period',['Q1','Q2'],x.period)}${input('Fecha','date',x.date,'date')}</div>`)); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)); const obj={...x,...f,amount:Number(f.amount),id:id||uid(),active:true}; id?Object.assign(x,obj):state.incomes.push(obj); save(); closeModal(); renderAll(); toast('Ingreso guardado');}; }
  function openExpense(id){ const x=state.expenses.find(i=>i.id===id)||{name:'',amount:'',category:'Fijos',period:'Q1',date:todayISO(),note:''}; modal(id?'Editar gasto':'Nuevo gasto',formWrap(`<div class="grid sm:grid-cols-2 gap-4">${input('Descripción','name',x.name,'text','required')}${input('Monto','amount',x.amount,'number','step="0.01" required')}${select('Categoría','category',['Fijos','Diarios','Hormiga','Mercado','Eventuales'],x.category)}${select('Periodo','period',['Q1','Q2'],x.period)}${input('Fecha','date',x.date,'date')}<label class="block sm:col-span-2"><span class="text-sm">Nota</span><textarea name="note" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-3">${esc(x.note)}</textarea></label></div>${id?'<button type="button" id="deleteFinance" class="w-full text-rose-600 py-2">Eliminar gasto</button>':''}`)); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)); const obj={...x,...f,amount:Number(f.amount),id:id||uid()}; id?Object.assign(x,obj):state.expenses.push(obj); save();closeModal();renderAll();toast('Gasto guardado');}; if(id)document.getElementById('deleteFinance').onclick=()=>{state.expenses=state.expenses.filter(i=>i.id!==id);save();closeModal();renderAll();}; }
  function openCart(id){ const x=state.cart.find(i=>i.id===id)||{productName:'',category:'Otros',qty:1,unit:'unidades',price:0,store:'market',done:false,date:todayISO()}; const names=state.products.map(p=>p.name); modal(id?'Editar producto':'Agregar al mercado',formWrap(`<div class="grid sm:grid-cols-2 gap-4"><label class="block sm:col-span-2"><span class="text-sm">Producto</span><input list="productNames" name="productName" value="${esc(x.productName)}" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-3"><datalist id="productNames">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label>${input('Cantidad','qty',x.qty,'number','step="0.01" required')}${select('Unidad','unit',UNITS,x.unit)}${select('Categoría','category',CATEGORY_OPTIONS,x.category)}${select('Referencia','store',[{value:'market',label:'Mercado local'},{value:'supermarket',label:'Supermercado'},{value:'wholesale',label:'Mayorista'}],x.store)}${input('Precio por unidad','price',x.price,'number','step="0.01" required')}${input('Fecha','date',x.date,'date')}</div>${id?'<button type="button" id="deleteCartModal" class="w-full text-rose-600 py-2">Eliminar producto</button>':''}`)); const form=document.getElementById('modalForm'); const nameInput=form.elements.productName; function syncProduct(){const p=productFor(nameInput.value.trim());if(p){form.elements.category.value=p.category;form.elements.unit.value=p.unit;form.elements.price.value=p[form.elements.store.value]||p.market;}} nameInput.addEventListener('change',syncProduct); form.elements.store.addEventListener('change',syncProduct); form.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const obj={...x,...f,qty:Number(f.qty),price:Number(f.price),id:id||uid(),done:x.done||false};id?Object.assign(x,obj):state.cart.push(obj);save();closeModal();renderAll();toast('Mercado actualizado');}; if(id)document.getElementById('deleteCartModal').onclick=()=>{deleteCart(id);closeModal();}; }
  function openPantry(id){ const x=state.pantry.find(i=>i.id===id)||{productName:'',category:'Otros',qty:0,unit:'unidades',min:1,dailyUse:0,expiry:'',conversion:1,purchaseUnit:'unidades'}; modal(id?'Editar despensa':'Agregar a despensa',formWrap(`<div class="grid sm:grid-cols-2 gap-4">${input('Producto','productName',x.productName,'text','required')}${select('Categoría','category',CATEGORY_OPTIONS,x.category)}${input('Stock actual','qty',x.qty,'number','step="0.01" required')}${select('Unidad en despensa','unit',UNITS,x.unit)}${input('Stock mínimo','min',x.min,'number','step="0.01"')}${input('Consumo diario por persona','dailyUse',x.dailyUse,'number','step="0.01"')}${input('Fecha de vencimiento','expiry',x.expiry,'date')}${select('Unidad de compra','purchaseUnit',UNITS,x.purchaseUnit)}${input('Conversión por unidad de compra','conversion',x.conversion,'number','step="0.01"')}</div>${id?'<button type="button" id="deletePantry" class="w-full text-rose-600 py-2">Eliminar de despensa</button>':''}`)); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const obj={...x,...f,qty:Number(f.qty),min:Number(f.min),dailyUse:Number(f.dailyUse),conversion:Number(f.conversion),id:id||uid()};id?Object.assign(x,obj):state.pantry.push(obj);save();closeModal();renderAll();toast('Despensa actualizada');}; if(id)document.getElementById('deletePantry').onclick=()=>{state.pantry=state.pantry.filter(i=>i.id!==id);save();closeModal();renderAll();}; }
  function openConsume(id){ const x=state.pantry.find(i=>i.id===id); modal('Registrar consumo',formWrap(`<p class="text-sm text-slate-500">Disponible: <strong>${x.qty} ${esc(x.unit)}</strong></p><div class="grid sm:grid-cols-2 gap-4 mt-4">${input('Cantidad consumida','amount',1,'number','step="0.01" required')}${select('Unidad','consumeUnit',compatibleUnits(x.unit),x.unit)}</div>`,'Descontar')); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));let amount=convert(Number(f.amount),f.consumeUnit,x.unit); if(amount>x.qty)return toast('No hay suficiente stock');x.qty=Math.max(0,x.qty-amount);save();closeModal();renderAll();toast('Consumo registrado');}; }

  function convertMeasure(value,from,to){
    value=Number(value); if(from===to)return value;
    const mass={kg:1000,g:1}; const volume={L:1000,ml:1};
    if(mass[from]&&mass[to])return value*mass[from]/mass[to];
    if(volume[from]&&volume[to])return value*volume[from]/volume[to];
    if(from==='docenas'&&to==='unidades')return value*12;
    if(from==='unidades'&&to==='docenas')return value/12;
    return null;
  }

  function compatibleUnits(u){ if(['kg','g'].includes(u))return ['kg','g']; if(['L','ml'].includes(u))return ['L','ml']; return [u]; }
  function convert(a,from,to){ if(from===to)return a; if(from==='g'&&to==='kg')return a/1000;if(from==='kg'&&to==='g')return a*1000;if(from==='ml'&&to==='L')return a/1000;if(from==='L'&&to==='ml')return a*1000;return a; }
  function openTask(id){ const x=state.tasks.find(i=>i.id===id)||{title:'',type:'Tarea',assigned:'Ambos',due:'',priority:'Media',done:false}; modal(id?'Editar tarea':'Nueva tarea',formWrap(`<div class="grid sm:grid-cols-2 gap-4"><div class="sm:col-span-2">${input('Título','title',x.title,'text','required')}</div>${select('Tipo','type',['Tarea','Compra general'],x.type)}${select('Responsable','assigned',[state.settings.partnerA,state.settings.partnerB,'Ambos'],x.assigned)}${input('Vencimiento','due',x.due,'date')}${select('Prioridad','priority',['Alta','Media','Baja'],x.priority)}</div>`)); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const obj={...x,...f,id:id||uid()};id?Object.assign(x,obj):state.tasks.push(obj);save();closeModal();renderAll();}; }
  function openProduct(id){ const x=state.products.find(i=>i.id===id)||{name:'',category:'Otros',unit:'unidades',market:0,supermarket:0,wholesale:0,pantryUnit:'unidades',conversion:1}; modal(id?'Editar producto master':'Nuevo producto master',formWrap(`<div class="grid sm:grid-cols-2 gap-4">${input('Nombre','name',x.name,'text','required')}${select('Categoría','category',CATEGORY_OPTIONS,x.category)}${select('Unidad de compra','unit',UNITS,x.unit)}${input('Precio mercado','market',x.market,'number','step="0.01"')}${input('Precio supermercado','supermarket',x.supermarket,'number','step="0.01"')}${input('Precio mayorista','wholesale',x.wholesale,'number','step="0.01"')}${select('Unidad de despensa','pantryUnit',UNITS,x.pantryUnit)}${input('Conversión','conversion',x.conversion,'number','step="0.01"')}</div>`)); document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const obj={...x,...f,market:Number(f.market),supermarket:Number(f.supermarket),wholesale:Number(f.wholesale),conversion:Number(f.conversion),id:id||uid()};id?Object.assign(x,obj):state.products.push(obj);save();closeModal();renderAll();}; }

  function toggleCart(id){
    const x=state.cart.find(i=>i.id===id); if(!x)return;
    if(!x.done){
      const paid=prompt('Total real pagado',String((x.qty*x.price).toFixed(2))); if(paid===null)return;
      x.actualTotal=Number(paid)||x.qty*x.price; x.done=true;
      state.expenses.push({id:uid(),name:`Mercado: ${x.productName}`,amount:x.actualTotal,category:'Mercado',period:new Date().getDate()<=15?'Q1':'Q2',date:todayISO(),note:'Generado desde Mercado',sourceCartId:x.id});
      const p=productFor(x.productName);
      let pantryUnit=p?.pantryUnit||x.unit, pantryQty=Number(x.qty);
      if(p){
        const inPurchaseUnit=convertMeasure(x.qty,x.unit,p.unit);
        const normalized=inPurchaseUnit===null?Number(x.qty):inPurchaseUnit;
        pantryQty=p.pantryUnit===p.unit?normalized:normalized*Number(p.conversion||1);
      }
      const existing=state.pantry.find(item=>normalizeText(item.productName)===normalizeText(x.productName));
      if(existing){
        let add=pantryQty;
        if(existing.unit!==pantryUnit){const c=convertMeasure(pantryQty,pantryUnit,existing.unit);if(c!==null)add=c;else {existing.unit=pantryUnit;}}
        existing.qty=Number(existing.qty||0)+add;
      } else state.pantry.push({id:uid(),productName:x.productName,category:x.category,qty:pantryQty,unit:pantryUnit,min:Math.max(1,pantryQty*.25),dailyUse:0,expiry:'',conversion:p?.conversion||1,purchaseUnit:p?.unit||x.unit});
    } else {
      x.done=false; state.expenses=state.expenses.filter(e=>e.sourceCartId!==x.id);
    }
    save();renderAll();
  }
  function deleteCart(id){ state.cart=state.cart.filter(i=>i.id!==id); state.expenses=state.expenses.filter(e=>e.sourceCartId!==id); save();renderAll(); }
  function reorder(id){ const x=state.pantry.find(i=>i.id===id); const needed=Math.max(1,x.min*2-x.qty); const qty=x.purchaseUnit!==x.unit?needed/(x.conversion||1):needed; const p=productFor(x.productName); state.cart.push({id:uid(),productName:x.productName,category:x.category,qty:Number(qty.toFixed(2)),unit:x.purchaseUnit,price:p?.market||0,store:'market',done:false,date:todayISO()}); save();renderAll();toast('Agregado al mercado'); }
  function shareCart(){ const groups={}; state.cart.filter(x=>!x.done).forEach(x=>(groups[x.category]??=[]).push(x)); const text=['🛒 LISTA DE COMPRAS · NUESTROESPACIO','',...Object.entries(groups).flatMap(([c,a])=>[`${c.toUpperCase()}:`,...a.map(x=>`☐ ${x.productName} — ${x.qty} ${x.unit}`),'']),`Estimado: ${money(totals().pending)}`].join('\n'); if(navigator.share)navigator.share({title:'Lista de compras',text}).catch(()=>{}); else navigator.clipboard.writeText(text).then(()=>toast('Lista copiada')); }

  function renderAll(){ renderDashboard(); renderFinances(); renderMarket(); renderPantry(); renderRecipes(); renderTasks(); renderSettings(); renderCatalog(); icon(); applyTheme(); }
  function showView(v){ currentView=v; document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v)); document.querySelectorAll('.nav-btn').forEach(b=>{const on=b.dataset.view===v;b.className=`nav-btn min-w-[72px] flex-1 text-xs py-2 rounded-xl ${on?'text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900':'text-slate-500 dark:text-zinc-400'}`}); window.scrollTo({top:0,behavior:'smooth'}); icon(); }
  function applyTheme(){ const dark=state.settings.theme==='dark'; document.documentElement.classList.toggle('dark',dark); document.documentElement.dataset.theme=dark?'dark':'light'; document.getElementById('themeBtn').innerHTML=`<i data-lucide="${dark?'sun':'moon'}" class="w-4 h-4"></i>`; icon(); }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    if(b.classList.contains('nav-btn')) showView(b.dataset.view);
    if(b.dataset.viewJump) showView(b.dataset.viewJump);
    const a=b.dataset.action; if(a==='add-income')openIncome(); if(a==='add-fixed-expense')openExpense(); if(a==='add-expense')openExpense(); if(a==='add-cart')openCart(); if(a==='add-pantry')openPantry(); if(a==='add-task')openTask(); if(a==='add-product')openProduct(); if(a==='share-cart')shareCart(); if(a==='quick-summary')modal('Análisis inteligente',advisor().map(x=>`<div class="p-3 rounded-xl bg-slate-100 dark:bg-zinc-800 mb-2">${esc(x)}</div>`).join(''));
    if(b.dataset.editFinance){const [k,id]=b.dataset.editFinance.split(':');k==='Ingreso'?openIncome(id):openExpense(id)}
    if(b.dataset.toggleCart)toggleCart(b.dataset.toggleCart); if(b.dataset.editCart)openCart(b.dataset.editCart); if(b.dataset.deleteCart)deleteCart(b.dataset.deleteCart);
    if(b.dataset.consume)openConsume(b.dataset.consume); if(b.dataset.reorder)reorder(b.dataset.reorder); if(b.dataset.editPantry)openPantry(b.dataset.editPantry);
    if(b.dataset.toggleTask){const x=state.tasks.find(i=>i.id===b.dataset.toggleTask);x.done=!x.done;save();renderAll();} if(b.dataset.editTask)openTask(b.dataset.editTask); if(b.dataset.deleteTask){state.tasks=state.tasks.filter(i=>i.id!==b.dataset.deleteTask);save();renderAll();}
    if(b.dataset.viewRecipe)openRecipe(b.dataset.viewRecipe,Number(b.dataset.servings||state.settings.peopleCount)); if(b.dataset.addRecipe)addRecipeToCart(b.dataset.addRecipe,Number(b.dataset.servings||state.settings.peopleCount)); if(b.dataset.favRecipe){const id=b.dataset.favRecipe;state.recipeFavorites=state.recipeFavorites.includes(id)?state.recipeFavorites.filter(x=>x!==id):[...state.recipeFavorites,id];save();renderRecipeList();}
    if(b.dataset.editProduct)openProduct(b.dataset.editProduct); if(b.dataset.deleteProduct){state.products=state.products.filter(i=>i.id!==b.dataset.deleteProduct);save();renderAll();}
    if(b.classList.contains('market-cat')){document.querySelectorAll('.market-cat').forEach(x=>x.className='market-cat shrink-0 px-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-zinc-800');b.className='market-cat shrink-0 px-3 py-2 rounded-xl text-sm bg-slate-900 text-white dark:bg-white dark:text-slate-900';renderCart(b.dataset.cat)}
    if(b.classList.contains('task-filter')){document.querySelectorAll('.task-filter').forEach(x=>x.className='task-filter shrink-0 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800');b.className='task-filter shrink-0 rounded-xl px-3 py-2 text-sm bg-slate-900 text-white dark:bg-white dark:text-slate-900';renderTaskList(b.dataset.taskfilter)}
  });
  document.addEventListener('input',e=>{ if(e.target.id==='financeSearch')renderFinanceList(); if(e.target.id==='pantrySearch')renderPantryList(); if(e.target.id==='catalogSearch')renderCatalogList(); if(e.target.id==='recipeSearch')renderRecipeList(); });
  document.addEventListener('change',e=>{ if(e.target.id==='financeFilter')renderFinanceList(); if(e.target.id==='marketStatus')renderCart(document.querySelector('.market-cat.bg-slate-900')?.dataset.cat||'Todos'); if(e.target.id==='pantryFilter')renderPantryList(); if(e.target.id==='catalogFilter')renderCatalogList(); if(['recipeRegion','recipePeople'].includes(e.target.id))renderRecipeList(); });
  document.getElementById('modalClose').onclick=closeModal; document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
  document.getElementById('themeBtn').onclick=()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';save();applyTheme();};
  document.getElementById('backupBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nuestroespacio-respaldo.json';a.click();URL.revokeObjectURL(a.href)};
  document.getElementById('fab').onclick=()=>{({dashboard:openTask,finanzas:openExpense,mercado:openCart,despensa:openPantry,recetas:()=>showView('recetas'),tareas:openTask,configuracion:()=>showView('configuracion'),catalogo:openProduct}[currentView]||openTask)()};

  renderAll();
})();
