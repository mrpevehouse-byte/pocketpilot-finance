/* PocketPilot Finance v1 - app.js (Updated Fix)
   - Investments appear immediately
   - Refresh Market Data works reliably
   - Alpha Vantage key handling improved
*/

const state = {
  transactions: JSON.parse(localStorage.getItem('pp_tx')||'[]'),
  budgets: JSON.parse(localStorage.getItem('pp_bud')||'[]'),
  goals: JSON.parse(localStorage.getItem('pp_goals')||'[]'),
  investments: JSON.parse(localStorage.getItem('pp_inv')||'[]'),
  avKey: localStorage.getItem('pp_avkey')||''
};

function save() {
  localStorage.setItem('pp_tx', JSON.stringify(state.transactions));
  localStorage.setItem('pp_bud', JSON.stringify(state.budgets));
  localStorage.setItem('pp_goals', JSON.stringify(state.goals));
  localStorage.setItem('pp_inv', JSON.stringify(state.investments));
  localStorage.setItem('pp_avkey', state.avKey);
}

function $(id){ return document.getElementById(id); }

renderDashboard(); renderTxList(); renderBudgets(); renderGoals(); renderInvList();
$('#avKey').value = state.avKey;

// --- Form Handlers ---
document.getElementById('txForm').addEventListener('submit', e=>{
  e.preventDefault();
  const t={type:$('#txType').value, amount:parseFloat($('#txAmount').value), category:$('#txCategory').value, date:$('#txDate').value, note:$('#txNote').value};
  state.transactions.push(t); save(); renderTxList(); renderDashboard(); e.target.reset();
});

document.getElementById('budgetForm').addEventListener('submit', e=>{
  e.preventDefault();
  const b={cat:$('#budgetCat').value, limit:parseFloat($('#budgetAmt').value)};
  state.budgets.push(b); save(); renderBudgets(); e.target.reset();
});

document.getElementById('goalForm').addEventListener('submit', e=>{
  e.preventDefault();
  const g={name:$('#goalName').value, target:parseFloat($('#goalTarget').value), saved:0};
  state.goals.push(g); save(); renderGoals(); e.target.reset();
});

document.getElementById('invForm').addEventListener('submit', e=>{
  e.preventDefault();
  const inv={symbol:$('#invSymbol').value.toUpperCase(), units:parseFloat($('#invShares').value), type:$('#invType').value};
  state.investments.push(inv); save(); renderInvList(); refreshMarketData(); e.target.reset();
});

$('#saveKey').addEventListener('click', ()=>{
  state.avKey = $('#avKey').value.trim();
  save();
  alert('Alpha Vantage key saved locally.');
});

$('#refreshData').addEventListener('click', ()=>{ refreshMarketData(); });
$('#exportBtn').addEventListener('click', ()=>{
  const data=JSON.stringify({transactions:state.transactions, budgets:state.budgets, goals:state.goals, investments:state.investments}, null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='pocketpilot_export.json'; a.click();
});
$('#clearBtn').addEventListener('click', ()=>{
  if(confirm('Clear all local data?')){ localStorage.clear(); location.reload(); }
});

// --- Render Functions ---
function renderDashboard(){
  const cash = state.transactions.reduce((s,t)=> t.type==='income' ? s+t.amount : s-t.amount, 0).toFixed(2);
  $('#cashflow').textContent = '$'+cash;
  $('#goalsummary').textContent = state.goals.length + ' goal(s)';
  const invValue = state.investments.reduce((s,inv)=> s + (inv.currentValue||0),0).toFixed(2);
  $('#investsummary').textContent = '$'+invValue;
}

function renderTxList(){
  const container = $('#txList'); container.innerHTML='';
  state.transactions.slice().reverse().forEach((t,i)=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML=`<div><strong>${t.type}</strong> ${t.category} <div class="smallmuted">${t.date} ${t.note||''}</div></div><div>${t.amount.toFixed(2)}</div>`;
    container.appendChild(el);
  });
}

function renderBudgets(){
  const c=$('#budgetList'); c.innerHTML='';
  state.budgets.forEach(b=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML=`<div>${b.cat}</div><div>$${b.limit.toFixed(2)}</div>`;
    c.appendChild(el);
  });
}

function renderGoals(){
  const c=$('#goalList'); c.innerHTML='';
  state.goals.forEach((g,idx)=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML=`<div>${g.name} <div class="smallmuted">Saved: $${g.saved.toFixed(2)}</div></div><div>$${g.target.toFixed(2)}</div>`;
    c.appendChild(el);
  });
}

function renderInvList(){
  const c=$('#invList'); c.innerHTML='';
  state.investments.forEach((inv,idx)=>{
    const el=document.createElement('div'); el.className='item';
    const val = inv.currentValue ? ('$'+inv.currentValue.toFixed(2)) : '<em>unfetched</em>';
    el.innerHTML=`<div>${inv.symbol} <div class="smallmuted">${inv.type}</div></div><div>${val}</div>`;
    c.appendChild(el);
  });
}

// --- Market Data Fetch ---
async function refreshMarketData(){
  $('#trendResults').innerHTML = '<div class="smallmuted">Fetching market data...</div>';
  const avKey = state.avKey || $('#avKey').value.trim();
  
  // Stocks
  const stockSymbols = Array.from(new Set(state.investments.filter(i=>i.type==='stock').map(i=>i.symbol)));
  const stockData = {};
  for(const s of stockSymbols){
    try{
      if(!avKey){ console.warn('No Alpha Vantage key set'); continue; }
      const url=`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(s)}&outputsize=compact&apikey=${encodeURIComponent(avKey)}`;
      const resp = await fetch(url); const j = await resp.json();
      if(j['Time Series (Daily)']){
        const series = j['Time Series (Daily)']; const dates = Object.keys(series).sort((a,b)=>new Date(a)-new Date(b));
        const latest = parseFloat(series[dates[dates.length-1]]['4. close']);
        const prev7 = parseFloat(series[dates[Math.max(0,dates.length-8)]]['4. close']);
        stockData[s] = {latest, prev7};
      } else { console.warn('AlphaVantage error', j); }
    } catch(err){ console.error(err); }
  }

  // Crypto
  const cryptoSymbols = state.investments.filter(i=>i.type==='crypto').map(i=>i.symbol.toLowerCase());
  const cryptoData = {};
  for(const sym of cryptoSymbols){
    try{
      const map={btc:'bitcoin', eth:'ethereum', usdt:'tether', bnb:'binancecoin'};
      const id = map[sym]||sym;
      const url=`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=31`;
      const resp=await fetch(url); const j=await resp.json();
      if(j.prices){
        const prices=j.prices; const latest=prices[prices.length-1][1]; const prev7=prices[Math.max(0,prices.length-8)][1];
        cryptoData[sym]= {latest, prev7};
      }
    } catch(err){ console.error(err); }
  }

  // Update investments
  for(const inv of state.investments){
    try{
      if(inv.type==='stock' && stockData[inv.symbol]){
        inv.currentPrice = stockData[inv.symbol].latest;
        inv.currentValue = inv.currentPrice*inv.units;
        inv._momentum = (stockData[inv.symbol].latest - stockData[inv.symbol].prev7)/stockData[inv.symbol].prev7;
      } else if(inv.type==='crypto' && cryptoData[inv.symbol.toLowerCase()]){
        const d = cryptoData[inv.symbol.toLowerCase()];
        inv.currentPrice = d.latest;
        inv.currentValue = inv.currentPrice*inv.units;
        inv._momentum = (d.latest - d.prev7)/d.prev7;
      }
    } catch(e){ console.error(e); }
  }

  save(); renderInvList(); renderDashboard();

  // Trend Tracker
  const candidates=[];
  for(const [s,d] of Object.entries(stockData)){ candidates.push({symbol:s, type:'stock', mom:(d.latest-d.prev7)/d.prev7, latest:d.latest}); }
  for(const [s,d] of Object.entries(cryptoData)){ candidates.push({symbol:s.toUpperCase(), type:'
latest-d.prev7)/d.prev7});
  }

  // Sort candidates by upward momentum
  candidates.sort((a,b)=> b.mom - a.mom);

  // Display top 5
  const trendContainer = $('#trendResults');
  trendContainer.innerHTML = '';
  if(candidates.length===0){
    trendContainer.innerHTML = '<div class="smallmuted">No market data available. Check API key or network.</div>';
    return;
  }

  trendContainer.innerHTML = '<div class="smallmuted">Top trending investments (not financial advice):</div>';
  candidates.slice(0,5).forEach(c=>{
    const el=document.createElement('div'); el.className='item';
    const pct = (c.mom*100).toFixed(2)+'%';
    el.innerHTML=`<div>${c.symbol} (${c.type})</div><div>${c.latest.toFixed(2)} USD / 7-day change: ${pct}</div>`;
    trendContainer.appendChild(el);
  });
}
