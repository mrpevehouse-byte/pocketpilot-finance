/* PocketPilot Finance v1 - app.js
   - Stores data locally in localStorage
   - Fetches stock data from Alpha Vantage (user provides API key)
   - Fetches crypto data from CoinGecko (no key)
   - Simple trend tracker: computes short-term % change and scores assets
*/
const state = {
  transactions: JSON.parse(localStorage.getItem('pp_tx')||'[]'),
  budgets: JSON.parse(localStorage.getItem('pp_bud')||'[]'),
  goals: JSON.parse(localStorage.getItem('pp_goals')||'[]'),
  investments: JSON.parse(localStorage.getItem('pp_inv')||'[]'),
  avKey: localStorage.getItem('pp_avkey')||''
};

function save(){ localStorage.setItem('pp_tx', JSON.stringify(state.transactions)); localStorage.setItem('pp_bud', JSON.stringify(state.budgets)); localStorage.setItem('pp_goals', JSON.stringify(state.goals)); localStorage.setItem('pp_inv', JSON.stringify(state.investments)); localStorage.setItem('pp_avkey', state.avKey); }

function $(id){return document.getElementById(id)}

// Initial render
renderDashboard(); renderTxList(); renderBudgets(); renderGoals(); renderInvList(); $('#avKey').value = state.avKey;

document.getElementById('txForm').addEventListener('submit', e=>{ e.preventDefault(); const t={type:$('#txType').value, amount:parseFloat($('#txAmount').value), category:$('#txCategory').value, date:$('#txDate').value, note:$('#txNote').value}; state.transactions.push(t); save(); renderTxList(); renderDashboard(); e.target.reset(); })
document.getElementById('budgetForm').addEventListener('submit', e=>{ e.preventDefault(); const b={cat:$('#budgetCat').value, limit:parseFloat($('#budgetAmt').value)}; state.budgets.push(b); save(); renderBudgets(); e.target.reset(); })
document.getElementById('goalForm').addEventListener('submit', e=>{ e.preventDefault(); const g={name:$('#goalName').value, target:parseFloat($('#goalTarget').value), saved:0}; state.goals.push(g); save(); renderGoals(); e.target.reset(); })
document.getElementById('invForm').addEventListener('submit', e=>{ e.preventDefault(); const inv={symbol:$('#invSymbol').value.toUpperCase(), units:parseFloat($('#invShares').value), type:$('#invType').value}; state.investments.push(inv); save(); renderInvList(); e.target.reset(); })
$('#saveKey').addEventListener('click', ()=>{ state.avKey = $('#avKey').value.trim(); save(); alert('Alpha Vantage key saved locally.'); })
$('#refreshData').addEventListener('click', ()=>{ refreshMarketData(); })
$('#exportBtn').addEventListener('click', ()=>{ const data=JSON.stringify({transactions:state.transactions, budgets:state.budgets, goals:state.goals, investments:state.investments},null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='pocketpilot_export.json'; a.click(); })
$('#clearBtn').addEventListener('click', ()=>{ if(confirm('Clear all local data?')){ localStorage.clear(); location.reload(); } })

function renderDashboard(){
  const cash = state.transactions.reduce((s,t)=> t.type==='income' ? s + t.amount : s - t.amount, 0).toFixed(2)
  $('#cashflow').textContent = '$'+cash
  $('#goalsummary').textContent = state.goals.length + ' goal(s)'
  const invValue = state.investments.reduce((s,inv)=> s + (inv.currentValue||0), 0).toFixed(2)
  $('#investsummary').textContent = '$'+invValue
}

function renderTxList(){
  const container = $('#txList'); container.innerHTML=''
  state.transactions.slice().reverse().forEach((t,i)=>{ const el=document.createElement('div'); el.className='item'; el.innerHTML=`<div><strong>${t.type}</strong> ${t.category} <div class="smallmuted">${t.date} ${t.note||''}</div></div><div>${t.amount.toFixed(2)}</div>`; container.appendChild(el); })
}

function renderBudgets(){
  const c = $('#budgetList'); c.innerHTML=''
  state.budgets.forEach(b=>{ const el=document.createElement('div'); el.className='item'; el.innerHTML=`<div>${b.cat}</div><div>$${b.limit.toFixed(2)}</div>`; c.appendChild(el); })
}

function renderGoals(){
  const c = $('#goalList'); c.innerHTML=''
  state.goals.forEach((g,idx)=>{ const el=document.createElement('div'); el.className='item'; el.innerHTML=`<div>${g.name} <div class="smallmuted">Saved: $${g.saved.toFixed(2)}</div></div><div>$${g.target.toFixed(2)}</div>`; c.appendChild(el); })
}

function renderInvList(){
  const c = $('#invList'); c.innerHTML=''
  state.investments.forEach((inv,idx)=>{ const el=document.createElement('div'); el.className='item'; const val = inv.currentValue ? ('$'+inv.currentValue.toFixed(2)) : '<em>unfetched</em>'; el.innerHTML=`<div>${inv.symbol} <div class="smallmuted">${inv.type}</div></div><div>${val}</div>`; c.appendChild(el); })
}

async function refreshMarketData(){
  $('#trendResults').innerHTML = '<div class="smallmuted">Fetching market data...</div>'
  // Stocks via Alpha Vantage (user-supplied key)
  const avKey = state.avKey || $('#avKey').value.trim();
  let stockSymbols = state.investments.filter(i=>i.type==='stock').map(i=>i.symbol)
  stockSymbols = Array.from(new Set(stockSymbols))
  const stockData = {}
  for(const s of stockSymbols){
    try{
      if(!avKey){ console.warn('No Alpha Vantage key set'); break; }
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(s)}&outputsize=compact&apikey=${encodeURIComponent(avKey)}`
      const resp = await fetch(url); const j = await resp.json()
      if(j['Time Series (Daily)']){
        const series = j['Time Series (Daily)']; const dates = Object.keys(series).sort((a,b)=>new Date(a)-new Date(b))
        const latest = parseFloat(series[dates[dates.length-1]]['4. close'])
        const prev7 = parseFloat(series[dates[Math.max(0,dates.length-8)]]['4. close'])
        const prev30 = parseFloat(series[dates[Math.max(0,dates.length-31)]]['4. close'])
        stockData[s] = {latest,prev7,prev30}
      } else {
        console.warn('AlphaVantage error', j)
      }
    }catch(err){ console.error(err) }
  }

  // Crypto via CoinGecko (simple current price + 7d/30d approximate via market_chart endpoint)
  const cryptoSymbols = state.investments.filter(i=>i.type==='crypto').map(i=>i.symbol.toLowerCase())
  const cryptoData = {}
  for(const sym of cryptoSymbols){
    try{
      // CoinGecko expects ids; we'll support common tickers mapping for v1 (BTC->bitcoin, ETH->ethereum)
      const map = {btc:'bitcoin', eth:'ethereum', usdt:'tether', bnb:'binancecoin'}
      const id = map[sym]||sym
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=31`
      const resp = await fetch(url); const j = await resp.json()
      if(j.prices){
        const prices = j.prices // [timestamp, price]
        const latest = prices[prices.length-1][1]
        const prev7 = prices[Math.max(0,prices.length-8)][1]
        const prev30 = prices[Math.max(0,prices.length-31)][1]
        cryptoData[sym] = {latest,prev7,prev30}
      }
    }catch(err){ console.error(err) }
  }

  // Compute current values and attach
  for(const inv of state.investments){
    try{
      if(inv.type==='stock' && stockData[inv.symbol]){
        inv.currentPrice = stockData[inv.symbol].latest
        inv.currentValue = inv.currentPrice * inv.units
        inv._momentum = (stockData[inv.symbol].latest - stockData[inv.symbol].prev7)/stockData[inv.symbol].prev7
      } else if(inv.type==='crypto' && cryptoData[inv.symbol.toLowerCase()]){
        const d = cryptoData[inv.symbol.toLowerCase()]
        inv.currentPrice = d.latest; inv.currentValue = inv.currentPrice * inv.units
        inv._momentum = (d.latest - d.prev7)/d.prev7
      } else {
        // leave as-is
      }
    }catch(e){ console.error(e) }
  }
  save(); renderInvList(); renderDashboard();

  // Trend suggestions: rank all known tickers by short-term momentum
  const candidates = []
  for(const [s,d] of Object.entries(stockData)){
    const mom = (d.latest - d.prev7)/d.prev7
    candidates.push({symbol:s, type:'stock', mom, latest:d.latest})
  }
  for(const [s,d] of Object.entries(cryptoData)){
    const mom = (d.latest - d.prev7)/d.prev7
    candidates.push({symbol:s.toUpperCase(), type:'crypto', mom, latest:d.latest})
  }
  candidates.sort((a,b)=>b.mom - a.mom)
  displayTrendResults(candidates.slice(0,8))
}

function displayTrendResults(cands){
  const c = $('#trendResults'); c.innerHTML=''
  if(!cands.length) return c.innerHTML='<div class="smallmuted">No market data available yet. Add investments and set Alpha Vantage API key for stocks.</div>'
  for(const it of cands){
    const el=document.createElement('div'); el.className='item'
    const pct = (it.mom*100).toFixed(2)
    el.innerHTML=`<div><strong>${it.symbol}</strong><div class="smallmuted">${it.type} • Latest: $${it.latest.toFixed(2)}</div></div><div>${pct}% (7d)</div>`
    c.appendChild(el)
  }
  const note=document.createElement('div'); note.className='smallmuted'; note.style.marginTop='8px'
  note.textContent = 'Suggestions are generated from short-term momentum (7-day pct change). These are signals to watch, not recommendations. Always do your own research.'
  c.appendChild(note)
}

// Basic install prompt handling
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').style.display = 'inline-block';
});
$('#installBtn').addEventListener('click', async ()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); const choiceResult = await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').style.display='none'; }
})

// Service worker registration
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>console.warn('sw failed')) }

// Auto-refresh market data on load (best-effort)
window.addEventListener('load', ()=>{ if(state.investments.length) refreshMarketData() })