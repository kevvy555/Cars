"use strict";

const MODEL_YEARS = 5;
const MODEL_MONTHS = MODEL_YEARS * 12;
const MODEL_MOT = 275;
const FUEL_LABELS = {R:"Unleaded",P:"Premium",D:"Diesel"};
const HANDLING_ORDER = ["Poor","Fair","Good","Very good","Excellent","Outstanding"];
const DEFAULTS = {annualMiles:6000,regularPrice:1.728,premiumPrice:1.901,dieselPrice:1.986};
const NUMERIC = new Set(["power_ps","weight_kg","zero_sixty_s","purchase_gbp","resale_gbp","mpg_uk","annual_ved_gbp","annual_insurance_gbp","servicing_5y_gbp","tyres_5y_gbp","repairs_brakes_5y_gbp","boot_l"]);
const money = n => "£" + Math.round(n).toLocaleString("en-GB");
const tidy = n => Number(n).toLocaleString("en-GB",{maximumFractionDigits:1});
const escapeHtml = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);

const COLUMNS = [
  {id:"name",label:"Vehicle",group:"Identity",type:"text",default:true},
  {id:"brand",label:"Brand",group:"Identity",type:"select"},
  {id:"years",label:"Model years",group:"Identity",type:"text",default:true},
  {id:"body",label:"Body style",group:"Identity",type:"select"},
  {id:"seats",label:"Rear seats",group:"Practicality",type:"select",default:true},
  {id:"gearbox",label:"Gearbox",group:"Practicality",type:"select",default:true},
  {id:"boot_l",label:"Boot",group:"Practicality",type:"number",default:true},
  {id:"power_ps",label:"Power",group:"Performance",type:"number",default:true},
  {id:"weight_kg",label:"Weight",group:"Performance",type:"number"},
  {id:"power_to_weight",label:"PS/t",group:"Performance",type:"number",default:true},
  {id:"zero_sixty_s",label:"0–60 mph",group:"Performance",type:"number",default:true},
  {id:"handling",label:"Handling",group:"Performance",type:"select",default:true},
  {id:"purchase_gbp",label:"Buy price",group:"Ownership",type:"number",default:true},
  {id:"resale_gbp",label:"Resale 2031",group:"Ownership",type:"number"},
  {id:"depreciation",label:"Depreciation",group:"Ownership",type:"number"},
  {id:"monthly",label:"Cost / mo",group:"Ownership",type:"number",default:true},
  {id:"total5",label:"Cost / 5y",group:"Ownership",type:"number",default:true},
  {id:"mpg_uk",label:"Real mpg",group:"Fuel & tax",type:"number"},
  {id:"fuel_grade",label:"Fuel type",group:"Fuel & tax",type:"select"},
  {id:"annual_fuel",label:"Fuel / yr",group:"Fuel & tax",type:"number"},
  {id:"fuel5",label:"Fuel / 5y",group:"Fuel & tax",type:"number"},
  {id:"annual_ved_gbp",label:"Tax / yr",group:"Fuel & tax",type:"number"},
  {id:"ved5",label:"Tax / 5y",group:"Fuel & tax",type:"number"},
  {id:"annual_insurance_gbp",label:"Insurance / yr",group:"Maintenance",type:"number"},
  {id:"insurance5",label:"Insurance / 5y",group:"Maintenance",type:"number"},
  {id:"servicing_5y_gbp",label:"Servicing / 5y",group:"Maintenance",type:"number"},
  {id:"tyres_5y_gbp",label:"Tyres / 5y",group:"Maintenance",type:"number"},
  {id:"repairs_brakes_5y_gbp",label:"Repairs / 5y",group:"Maintenance",type:"number"},
  {id:"mot5",label:"MOT / 5y",group:"Maintenance",type:"number"},
  {id:"prep",label:"Buying / selling",group:"Maintenance",type:"number"}
];
const COLUMN_MAP = Object.fromEntries(COLUMNS.map(c=>[c.id,c]));
const VISIBLE_DEFAULT = COLUMNS.filter(c=>c.default).map(c=>c.id);
let cars = [];
let lastFiltered = [];
let lastFocus = null;
let toastTimer;
const state = {
  scenario:{...DEFAULTS},
  search:"",
  presets:new Set(),
  filters:{},
  sort:{id:"monthly",direction:"desc"},
  columns:new Set(VISIBLE_DEFAULT),
  selected:new Set(),
  openPopover:null
};

function csvParse(source){
  const result=[],row=[];let current="",quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(c==='"'&&source[i+1]==='"'){current+='"';i++;}else if(c==='"'){quoted=false;}else current+=c;}
    else if(c==='"'){quoted=true;}
    else if(c===","){row.push(current);current="";}
    else if(c==="\n"||c==="\r"){
      if(c==="\r"&&source[i+1]==="\n")i++;
      row.push(current);current="";
      if(row.some(v=>v.trim()))result.push(row.splice(0));
      else row.length=0;
    }else current+=c;
  }
  if(current||row.length){row.push(current);result.push(row);}
  if(!result.length)throw Error("Empty car dataset");
  const headers=result.shift();
  return result.map((r,i)=>{
    if(r.length!==headers.length)throw Error("Invalid CSV row "+(i+2));
    const obj=Object.fromEntries(headers.map((h,j)=>[h,NUMERIC.has(h)?Number(r[j]):r[j]]));
    if(!obj.name||!obj.mpg_uk||!obj.weight_kg)throw Error("Missing required value at row "+(i+2));
    obj.power_to_weight=Math.round(obj.power_ps/obj.weight_kg*1000);
    obj.body=bodyStyle(obj.name);
    obj.id=obj.name;
    obj.baseline=obj.name.includes("320d F31 M Sport (yours)");
    return obj;
  });
}
function bodyStyle(name){
  if(/Touring|Estate|Avant|Sportbrake|Cupra ST|Octavia vRS|Focus ST 250|Clubman Cooper/i.test(name))return "Estate";
  if(/convertible|Roadster|Boxster|MX-5|Honda S2000/i.test(name))return "Convertible";
  if(/Gran Coupe|Sportback|Giulia|XE 25t|M3 E90|M3 F80|WRX|A250|A4 Avant/i.test(name))return "Saloon / liftback";
  if(/911|Cayman|Evora|M3 E92|M4 F82|M2 |M240i|Z4 3.0si Coupe|370Z|350Z|GT86|Vantage|F-Type|TT RS/i.test(name))return "Coupé / sports";
  return "Hatchback";
}
function refreshCalculations(){
  const {annualMiles,regularPrice,premiumPrice,dieselPrice}=state.scenario;
  const prices={R:regularPrice,P:premiumPrice,D:dieselPrice};
  for(const c of cars){
    c.depreciation=c.purchase_gbp-c.resale_gbp;
    c.annual_fuel=(annualMiles*4.54609/c.mpg_uk)*prices[c.fuel_grade];
    c.fuel5=c.annual_fuel*MODEL_YEARS;
    c.ved5=c.annual_ved_gbp*MODEL_YEARS;
    c.insurance5=c.annual_insurance_gbp*MODEL_YEARS;
    c.mot5=MODEL_MOT;
    c.prep=c.baseline?0:350;
    c.total5=c.depreciation+c.fuel5+c.ved5+c.insurance5+c.servicing_5y_gbp+c.tyres_5y_gbp+c.repairs_brakes_5y_gbp+c.mot5+c.prep;
    c.monthly=c.total5/MODEL_MONTHS;
  }
}
function display(c,id){
  const v=c[id];
  if(id==="monthly")return money(v)+"/mo";
  if(["purchase_gbp","resale_gbp","depreciation","total5","annual_fuel","fuel5","annual_ved_gbp","ved5","annual_insurance_gbp","insurance5","servicing_5y_gbp","tyres_5y_gbp","repairs_brakes_5y_gbp","mot5","prep"].includes(id))return money(v);
  if(id==="zero_sixty_s")return tidy(v)+"s";
  if(id==="power_to_weight")return tidy(v)+" PS/t";
  if(id==="power_ps")return tidy(v)+" PS";
  if(id==="boot_l")return tidy(v)+" L";
  if(id==="weight_kg")return tidy(v)+" kg";
  if(id==="mpg_uk")return tidy(v)+" mpg";
  if(id==="fuel_grade")return FUEL_LABELS[v]||v;
  return String(v??"—");
}
function isFourAdults(c){return c.seats==="4 adults"||c.seats==="4 adults (2-door)";}
function isNewer(c){const y=Number(c.years.slice(0,4));return y>=2018;}
function matches(c){
  const query=state.search.trim().toLowerCase();
  if(query&&![c.name,c.brand,c.years,c.body,c.gearbox,c.seats].some(v=>String(v).toLowerCase().includes(query)))return false;
  if(state.presets.has("adults")&&!isFourAdults(c))return false;
  if(state.presets.has("manual")&&!c.gearbox.toLowerCase().startsWith("manual"))return false;
  if(state.presets.has("budget")&&c.purchase_gbp>15000)return false;
  if(state.presets.has("petrol")&&c.fuel_grade==="D")return false;
  if(state.presets.has("newer")&&!isNewer(c))return false;
  for(const [id,filter] of Object.entries(state.filters)){
    const value=c[id];const col=COLUMN_MAP[id];if(!col)continue;
    if(col.type==="number"){
      if(filter.min!==""&&filter.min!=null&&Number(value)<Number(filter.min))return false;
      if(filter.max!==""&&filter.max!=null&&Number(value)>Number(filter.max))return false;
    }else if(col.type==="text"){
      if(filter.text&&!String(value).toLowerCase().includes(filter.text.toLowerCase()))return false;
    }else if(filter.values?.length){
      if(!filter.values.includes(String(value)))return false;
    }
  }
  return true;
}
function sortedVisible(){
  const filtered=cars.filter(matches),{id,direction}=state.sort,dir=direction==="asc"?1:-1;
  filtered.sort((a,b)=>{
    const av=a[id],bv=b[id];let n;
    if(id==="handling")n=HANDLING_ORDER.indexOf(av)-HANDLING_ORDER.indexOf(bv);
    else if(typeof av==="number"&&typeof bv==="number")n=av-bv;
    else n=String(av).localeCompare(String(bv),"en",{numeric:true});
    return (n||a.name.localeCompare(b.name))*dir;
  });
  return filtered;
}
function formatCell(c,id){
  const value=escapeHtml(display(c,id));
  if(id==="monthly")return '<strong class="value-emph">'+money(c.monthly)+'</strong>';
  if(id==="name")return '<span class="car-cell"><input type="checkbox" aria-label="Select '+escapeHtml(c.name)+' for comparison" data-compare="'+escapeHtml(c.id)+'" '+(state.selected.has(c.id)?"checked":"")+'><span><span class="car-name">'+escapeHtml(c.name)+(c.baseline?'<span class="owner-label">YOUR CAR</span>':'')+'</span><span class="car-brand">'+escapeHtml(c.brand)+' · '+escapeHtml(c.years)+'</span></span></span>';
  if(id==="handling")return '<span class="rating '+(c.handling==="Outstanding"?"outstanding":c.handling==="Excellent"?"excellent":"")+'">'+value+'</span>';
  if(id==="zero_sixty_s"||id==="power_to_weight")return '<span class="performance-cell">'+value+'</span>';
  if(id==="seats")return '<span class="'+(isFourAdults(c)?"seat-good":"seat-limited")+'">'+value+'</span>';
  return value;
}
function renderTable(){
  lastFiltered=sortedVisible();
  const visible=COLUMNS.filter(c=>state.columns.has(c.id));
  if(!visible.some(c=>c.id==="name")){state.columns.add("name");visible.unshift(COLUMN_MAP.name);}
  $("tableHead").innerHTML='<tr>'+visible.map(col=>{
    const active=!!state.filters[col.id],sorted=state.sort.id===col.id;
    return '<th scope="col"><div class="column-head"><button class="sort-button" data-sort="'+col.id+'" aria-label="Sort by '+escapeHtml(col.label)+'">'+escapeHtml(col.label)+'<span class="sort-indicator">'+(sorted?(state.sort.direction==="asc"?"↑":"↓"):"")+'</span></button><button class="column-filter-btn '+(active?"has-filter":"")+'" data-filter="'+col.id+'" aria-label="Filter '+escapeHtml(col.label)+'" title="Filter '+escapeHtml(col.label)+'">⌕</button></div></th>';
  }).join("")+'</tr>';
  $("tableBody").innerHTML=lastFiltered.map(c=>'<tr class="'+(c.baseline?"baseline":"")+'" data-car="'+escapeHtml(c.id)+'" tabindex="0" aria-label="Details for '+escapeHtml(c.name)+'">'+visible.map(col=>'<td>'+formatCell(c,col.id)+'</td>').join("")+'</tr>').join("");
  $("emptyState").hidden=lastFiltered.length>0;
  $("carTable").hidden=!lastFiltered.length;
  $("visibleCount").textContent=lastFiltered.length+" of "+cars.length+" cars";
  $("resultSummary").textContent=lastFiltered.length===cars.length?"All "+cars.length+" vehicles":lastFiltered.length+" vehicles match";
  $("rowCountBottom").textContent=lastFiltered.length+" rows · "+visible.length+" columns";
  $("visibleColumnsCount").textContent=visible.length;
  $("statCars").textContent=cars.length;
  $("statMiles").innerHTML=tidy(state.scenario.annualMiles*MODEL_YEARS)+' <i>mi</i>';
  const baseline=cars.find(c=>c.baseline);if(baseline)$("statBaseline").innerHTML=money(baseline.monthly)+' <i>/mo</i>';
  updateCompareBar();
  renderActiveFilters();
}
function renderActiveFilters(){
  const labels={adults:"4 adult seats",manual:"Manual gearbox",budget:"Buy ≤ £15,000",petrol:"Petrol",newer:"2018 onward"};
  const tags=[...state.presets].map(id=>({id:"preset:"+id,label:labels[id]}));
  if(state.search.trim())tags.push({id:"search",label:'Search: '+state.search.trim()});
  for(const [id,f] of Object.entries(state.filters)){
    let val="";
    if(f.text)val=f.text;
    if(f.values?.length)val=f.values.join(", ");
    if(f.min!==""&&f.min!=null)val+=" ≥ "+f.min;
    if(f.max!==""&&f.max!=null)val+=" ≤ "+f.max;
    tags.push({id:"column:"+id,label:COLUMN_MAP[id].label+": "+val});
  }
  $("activeFilters").innerHTML=tags.map(t=>'<span class="filter-tag">'+escapeHtml(t.label)+' <button aria-label="Remove '+escapeHtml(t.label)+'" data-remove-filter="'+escapeHtml(t.id)+'">×</button></span>').join("");
  document.querySelectorAll("[data-preset]").forEach(b=>b.setAttribute("aria-pressed",String(state.presets.has(b.dataset.preset))));
}
function filterPopover(event,id){
  closePopovers();
  const col=COLUMN_MAP[id];if(!col)return;
  const f=state.filters[id]||{min:"",max:"",text:"",values:[]};
  const title='<div class="popover-title">Filter '+escapeHtml(col.label)+'<button data-popclose aria-label="Close filter">✕</button></div>';
  let body="";
  if(col.type==="number"){
    body='<div class="range-fields"><label>Minimum<input type="number" step="any" data-f-min="'+id+'" value="'+escapeHtml(f.min??"")+'" placeholder="Any"></label><label>Maximum<input type="number" step="any" data-f-max="'+id+'" value="'+escapeHtml(f.max??"")+'" placeholder="Any"></label></div>';
  }else if(col.type==="text"){
    body='<label>Contains<input type="text" data-f-text="'+id+'" value="'+escapeHtml(f.text??"")+'" placeholder="Enter text…"></label>';
  }else{
    const vals=[...new Set(cars.map(c=>String(c[id])))].sort((a,b)=>id==="handling"?HANDLING_ORDER.indexOf(a)-HANDLING_ORDER.indexOf(b):a.localeCompare(b,"en",{numeric:true}));
    body='<div class="multi-options">'+vals.map(v=>'<label class="multi-option"><input type="checkbox" data-f-value="'+id+'" value="'+escapeHtml(v)+'" '+(f.values?.includes(v)?"checked":"")+'><span>'+escapeHtml(id==="fuel_grade"?(FUEL_LABELS[v]||v):v)+'</span></label>').join("")+'</div>';
  }
  $("filterPopover").innerHTML=title+body+'<div class="popover-footer"><button class="clear" data-clear-column="'+id+'">Clear filter</button><button data-popclose>Done</button></div>';
  showPopover("filterPopover",event.currentTarget);
}
function showPopover(id,anchor){
  const el=$(id);el.hidden=false;state.openPopover=id;
  const rect=anchor.getBoundingClientRect();
  const width=el.offsetWidth;const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
  const y=rect.bottom+7;
  el.style.left=left+"px";el.style.top=(y+el.offsetHeight>window.innerHeight-10?Math.max(10,rect.top-el.offsetHeight-7):y)+"px";
}
function closePopovers(){for(const id of ["filterPopover","columnPopover"])$(id).hidden=true;state.openPopover=null;$("columnsButton").setAttribute("aria-expanded","false");}
function openColumns(event){
  if(state.openPopover==="columnPopover"){closePopovers();return;}
  closePopovers();
  const groups=[...new Set(COLUMNS.map(c=>c.group))];
  $("columnPopover").innerHTML='<div class="popover-title">Visible columns <button data-popclose aria-label="Close columns">✕</button></div><div class="popover-footer"><button data-columns-all>Show all</button><button class="clear" data-columns-default>Defaults</button></div>'+groups.map(group=>'<div class="column-group">'+escapeHtml(group)+'</div>'+COLUMNS.filter(c=>c.group===group).map(c=>'<label class="multi-option"><input type="checkbox" data-column-toggle="'+c.id+'" '+(state.columns.has(c.id)?"checked":"")+' '+(c.id==="name"?"disabled":"")+'><span>'+escapeHtml(c.label)+'</span></label>').join("")).join("");
  $("columnsButton").setAttribute("aria-expanded","true");
  showPopover("columnPopover",event.currentTarget);
}
function clearColumn(id){delete state.filters[id];renderTable();}
function updateColumnFilter(id,key,val){
  const col=COLUMN_MAP[id];const f={min:"",max:"",text:"",values:[],...(state.filters[id]||{})};
  if(key==="values"){const list=new Set(f.values);if(val.checked)list.add(val.value);else list.delete(val.value);f.values=[...list];}
  else f[key]=val;
  if((col.type==="number"&&f.min===""&&f.max==="")||(col.type==="text"&&!f.text)||(col.type==="select"&&!f.values.length))delete state.filters[id];
  else state.filters[id]=f;
  renderTable();
}
function resetFilters(){
  state.search="";state.presets.clear();state.filters={};state.sort={id:"monthly",direction:"desc"};
  state.columns=new Set(VISIBLE_DEFAULT);
  $("searchInput").value="";
  closePopovers();renderTable();
}
function updateCompareBar(){
  $("compareBar").hidden=state.selected.size===0;
  $("compareLabel").textContent=state.selected.size+" of 3 selected";
  $("compareAction").disabled=state.selected.size<2;
}
function selectForComparison(id,checked){
  if(checked&&state.selected.size>=3&&!state.selected.has(id)){showToast("Compare up to three cars at once");renderTable();return;}
  if(checked)state.selected.add(id);else state.selected.delete(id);
  updateCompareBar();
}
function showToast(msg){const t=$("toast");clearTimeout(toastTimer);t.textContent=msg;t.hidden=false;toastTimer=setTimeout(()=>t.hidden=true,3400);}
function drawCar(c){
  lastFocus=document.activeElement;
  const rows=[
    ["Depreciation",c.depreciation],["Fuel (5 years)",c.fuel5],["Road tax (5 years)",c.ved5],
    ["Insurance (5 years)",c.insurance5],["Independent servicing",c.servicing_5y_gbp],
    ["Tyres",c.tyres_5y_gbp],["Repairs and brakes reserve",c.repairs_brakes_5y_gbp],["MOT",c.mot5],["Purchase / sale preparation",c.prep]
  ];
  $("drawerContent").innerHTML='<span class="drawer-badge">'+escapeHtml(c.baseline?"Your benchmark":"Ownership estimate")+'</span>'+
    '<h2 class="drawer-title">'+escapeHtml(c.name)+'</h2><div class="drawer-subtitle">'+escapeHtml(c.years)+' · '+escapeHtml(c.body)+' · '+escapeHtml(c.gearbox)+'</div>'+
    '<div class="drawer-metrics"><div class="drawer-metric"><span>Monthly cost</span><strong>'+money(c.monthly)+'</strong></div><div class="drawer-metric"><span>0–60 mph</span><strong>'+tidy(c.zero_sixty_s)+'s</strong></div><div class="drawer-metric"><span>Power/weight</span><strong>'+c.power_to_weight+'</strong><small> PS/t</small></div></div>'+
    '<section class="drawer-section"><h3>Performance & everyday use</h3>'+
    [['Power',c.power_ps+' PS'],['Representative weight',tidy(c.weight_kg)+' kg'],['Handling',c.handling],['Rear seating',c.seats],['Boot capacity',c.boot_l+' litres'],['Gearbox',c.gearbox],['Assumed economy',c.mpg_uk+' UK mpg'],['Fuel',FUEL_LABELS[c.fuel_grade]]].map(([k,v])=>'<div class="drawer-power"><span>'+escapeHtml(k)+'</span><strong>'+escapeHtml(v)+'</strong></div>').join("")+'</section>'+
    '<section class="drawer-section"><h3>Five-year cost breakdown</h3><div class="drawer-cost-list">'+rows.map(([k,v])=>'<div class="drawer-cost-row"><span>'+escapeHtml(k)+'</span><strong>'+money(v)+'</strong></div>').join("")+'<div class="drawer-cost-row total"><span>Five-year total</span><strong>'+money(c.total5)+'</strong></div></div></section>'+
    '<section class="drawer-section"><h3>Buy versus sell</h3><div class="drawer-power"><span>Indicative purchase (2026)</span><strong>'+money(c.purchase_gbp)+'</strong></div><div class="drawer-power"><span>Modelled resale (2031)</span><strong>'+money(c.resale_gbp)+'</strong></div><div class="drawer-power"><span>Estimated change in value</span><strong>'+money(c.depreciation)+'</strong></div><p class="drawer-note">The figures are illustrative for a representative '+escapeHtml(c.years)+' vehicle, not a personal quote or a guaranteed sale value. Repairs are a reserve, not necessarily money spent. Boot figures are indicative; sports-car compartment layouts may limit practical capacity.</p></section>';
  $("drawerOverlay").hidden=false;$("detailsDrawer").classList.add("open");$("detailsDrawer").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";$("closeDrawer").focus();
}
function closeDrawer(){
  $("detailsDrawer").classList.remove("open");$("detailsDrawer").setAttribute("aria-hidden","true");$("drawerOverlay").hidden=true;document.body.style.overflow="";
  if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
}
function compare(){
  const selections=[...state.selected].map(id=>cars.find(c=>c.id===id)).filter(Boolean);if(selections.length<2)return;
  const items=[
    ["Monthly ownership",c=>money(c.monthly),"min",c=>c.monthly],
    ["Five-year total",c=>money(c.total5),"min",c=>c.total5],
    ["0–60 mph",c=>tidy(c.zero_sixty_s)+"s","min",c=>c.zero_sixty_s],
    ["Power-to-weight",c=>c.power_to_weight+" PS/t","max",c=>c.power_to_weight],
    ["Handling",c=>c.handling,null],
    ["Rear seats",c=>c.seats,null],["Boot capacity",c=>c.boot_l+" L","max",c=>c.boot_l],
    ["Gearbox",c=>c.gearbox,null],["Buy price",c=>money(c.purchase_gbp),"min",c=>c.purchase_gbp],
    ["2031 resale",c=>money(c.resale_gbp),null],
    ["Depreciation",c=>money(c.depreciation),"min",c=>c.depreciation],
    ["Fuel · 5y",c=>money(c.fuel5),"min",c=>c.fuel5],
    ["VED · 5y",c=>money(c.ved5),"min",c=>c.ved5],
    ["Insurance · 5y",c=>money(c.insurance5),"min",c=>c.insurance5],
    ["Servicing · 5y",c=>money(c.servicing_5y_gbp),"min",c=>c.servicing_5y_gbp],
    ["Tyres · 5y",c=>money(c.tyres_5y_gbp),"min",c=>c.tyres_5y_gbp],
    ["Repair reserve · 5y",c=>money(c.repairs_brakes_5y_gbp),"min",c=>c.repairs_brakes_5y_gbp]
  ];
  const html='<div class="compare-grid" style="--compare-count:'+selections.length+'"><div class="compare-header compare-key">METRIC</div>'+selections.map(c=>'<div class="compare-header">'+escapeHtml(c.name)+'</div>').join("")+
    items.map(([label,fmt,best,raw])=>{
      const vals=raw?selections.map(raw):[];const winning=best==="min"?Math.min(...vals):best==="max"?Math.max(...vals):null;
      return '<div class="compare-key">'+escapeHtml(label)+'</div>'+selections.map(c=>'<div class="'+(raw&&raw(c)===winning?"compare-best":"")+'">'+escapeHtml(fmt(c))+'</div>').join("");
    }).join("")+'</div>';
  $("compareContent").innerHTML=html;$("compareDialog").showModal();
}
function downloadCsv(){
  if(!lastFiltered.length){showToast("No rows to export");return;}
  const ids=COLUMNS.map(c=>c.id);
  const enc=s=>'"'+String(s??"").replace(/"/g,'""')+'"';
  const content=[ids.map(id=>enc(COLUMN_MAP[id].label)).join(","),...lastFiltered.map(c=>ids.map(id=>enc(c[id]??"")).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="car-atlas-5-year-comparison.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast("Exported "+lastFiltered.length+" cars with all "+ids.length+" columns");
}
function bindEvents(){
  $("tableHead").addEventListener("click",event=>{
    const sort=event.target.closest("[data-sort]");if(sort){const id=sort.dataset.sort;if(state.sort.id===id)state.sort.direction=state.sort.direction==="asc"?"desc":"asc";else state.sort={id,direction:["name","brand","body","seats","gearbox","handling","years"].includes(id)?"asc":"desc"};renderTable();return;}
    const filter=event.target.closest("[data-filter]");if(filter)filterPopover({currentTarget:filter},filter.dataset.filter);
  });
  $("tableBody").addEventListener("click",event=>{
    const check=event.target.closest("[data-compare]");
    if(check){selectForComparison(check.dataset.compare,check.checked);event.stopPropagation();return;}
    const tr=event.target.closest("tr[data-car]");if(tr){const c=cars.find(x=>x.id===tr.dataset.car);if(c)drawCar(c);}
  });
  $("tableBody").addEventListener("keydown",event=>{if(event.key==="Enter"&&event.target.matches("tr[data-car]")){const c=cars.find(x=>x.id===event.target.dataset.car);if(c)drawCar(c);}});
  $("searchInput").addEventListener("input",e=>{state.search=e.target.value;renderTable();});
  document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>{
    if(state.presets.has(b.dataset.preset))state.presets.delete(b.dataset.preset);else state.presets.add(b.dataset.preset);renderTable();
  }));
  $("resetButton").addEventListener("click",resetFilters);$("emptyReset").addEventListener("click",resetFilters);
  $("activeFilters").addEventListener("click",e=>{const b=e.target.closest("[data-remove-filter]");if(!b)return;const id=b.dataset.removeFilter;
    if(id==="search"){$("searchInput").value="";state.search="";}
    else if(id.startsWith("preset:"))state.presets.delete(id.slice(7));
    else if(id.startsWith("column:"))delete state.filters[id.slice(7)];
    renderTable();
  });
  $("columnsButton").addEventListener("click",openColumns);
  $("columnPopover").addEventListener("change",e=>{const id=e.target.dataset.columnToggle;if(!id)return;if(e.target.checked)state.columns.add(id);else state.columns.delete(id);state.columns.add("name");renderTable();});
  $("columnPopover").addEventListener("click",e=>{
    if(e.target.closest("[data-columns-all]")){state.columns=new Set(COLUMNS.map(c=>c.id));closePopovers();renderTable();}
    if(e.target.closest("[data-columns-default]")){state.columns=new Set(VISIBLE_DEFAULT);closePopovers();renderTable();}
  });
  $("filterPopover").addEventListener("input",e=>{
    const id=e.target.dataset.fMin;if(id){updateColumnFilter(id,"min",e.target.value);return;}
    const max=e.target.dataset.fMax;if(max){updateColumnFilter(max,"max",e.target.value);return;}
    const text=e.target.dataset.fText;if(text)updateColumnFilter(text,"text",e.target.value);
  });
  $("filterPopover").addEventListener("change",e=>{const id=e.target.dataset.fValue;if(id)updateColumnFilter(id,"values",{value:e.target.value,checked:e.target.checked});});
  $("filterPopover").addEventListener("click",e=>{const b=e.target.closest("[data-clear-column]");if(b){clearColumn(b.dataset.clearColumn);closePopovers();}});
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-popclose]")){closePopovers();return;}
    if(state.openPopover&&!e.target.closest(".popover")&&!e.target.closest("[data-filter]")&&!e.target.closest("#columnsButton"))closePopovers();
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(state.openPopover)closePopovers();if($("detailsDrawer").classList.contains("open"))closeDrawer();}});
  window.addEventListener("resize",closePopovers);
  $("toggleAssumptions").addEventListener("click",()=>{const el=$("assumptionsPanel");el.hidden=!el.hidden;$("toggleAssumptions").setAttribute("aria-expanded",String(!el.hidden));});
  for(const [id,key] of [["annualMiles","annualMiles"],["regularPrice","regularPrice"],["premiumPrice","premiumPrice"],["dieselPrice","dieselPrice"]]){
    $(id).addEventListener("change",e=>{
      const input=e.target;const num=Number(input.value);const min=Number(input.min),max=Number(input.max);
      if(!Number.isFinite(num)||num<min||num>max){showToast("Enter a value between "+min+" and "+max);input.value=state.scenario[key];return;}
      state.scenario[key]=num;refreshCalculations();renderTable();
    });
  }
  $("resetAssumptions").addEventListener("click",()=>{state.scenario={...DEFAULTS};for(const key of Object.keys(DEFAULTS))$(key).value=DEFAULTS[key];refreshCalculations();renderTable();});
  $("exportButton").addEventListener("click",downloadCsv);
  $("compareClear").addEventListener("click",()=>{state.selected.clear();renderTable();});
  $("compareAction").addEventListener("click",compare);
  $("closeCompare").addEventListener("click",()=>$("compareDialog").close());
  $("closeDrawer").addEventListener("click",closeDrawer);
  $("drawerOverlay").addEventListener("click",closeDrawer);
}
async function start(){
  bindEvents();
  try{
    const response=await fetch("data/cars.csv",{cache:"no-cache"});
    if(!response.ok)throw Error("HTTP "+response.status);
    cars=csvParse(await response.text());
    refreshCalculations();renderTable();
  }catch(error){
    $("visibleCount").textContent="Data unavailable";
    $("tableBody").innerHTML='<tr><td colspan="12">Could not load the dataset. Serve the project over HTTP rather than opening index.html directly.</td></tr>';
    $("resultSummary").textContent="Unable to load cars";
    console.error("Car Atlas:",error);
  }
}
document.addEventListener("DOMContentLoaded",start);
