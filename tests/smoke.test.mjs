import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const csv = fs.readFileSync(new URL("../data/cars.csv", import.meta.url), "utf8");
const context = {document:{addEventListener(){}},CSV:csv,console};
vm.runInNewContext(code + `
  cars = csvParse(CSV);
  refreshCalculations();
  globalThis.spec = {cars,state,sortedVisible,refreshCalculations,csvParse,display,isFourAdults};
`,context);
const {cars,state,sortedVisible,refreshCalculations,csvParse,isFourAdults} = context.spec;
const byName=name=>cars.find(c=>c.name===name);

test("61 unique vehicles with complete finite ownership totals",()=>{
  assert.equal(cars.length,61);
  assert.equal(new Set(cars.map(c=>c.name)).size,61);
  assert.ok(cars.every(c=>Number.isFinite(c.monthly)&&Number.isFinite(c.total5)&&c.total5>0));
  assert.ok(cars.every(c=>c.power_to_weight===Math.round(c.power_ps/c.weight_kg*1000)));
});

test("cost totals reproduce the original 6,000-mile planning scenario",()=>{
  assert.ok(Math.abs(byName("BMW 320d F31 M Sport (yours)").monthly-308)<2);
  assert.ok(Math.abs(byName("BMW M140i F20 five-door").monthly-504)<2);
  assert.ok(Math.abs(byName("BMW 340i Touring F31").monthly-514)<2);
  assert.ok(Math.abs(byName("Aston Martin V8 Vantage 4.7").monthly-715)<2);
});

test("mileage changes fuel but not depreciation or insurance",()=>{
  const car=byName("BMW M140i F20 five-door");
  const original={fuel5:car.fuel5,monthly:car.monthly,dep:car.depreciation,insurance:car.insurance5};
  state.scenario.annualMiles=12000;refreshCalculations();
  assert.ok(Math.abs(car.fuel5-original.fuel5*2)<1);
  assert.equal(car.depreciation,original.dep);
  assert.equal(car.insurance5,original.insurance);
  assert.ok(car.monthly>original.monthly);
  state.scenario.annualMiles=6000;refreshCalculations();
});

test("preset and per-column filters work together",()=>{
  state.presets.add("manual");
  assert.ok(sortedVisible().length>35);
  assert.ok(sortedVisible().every(c=>c.gearbox.startsWith("Manual")));
  state.presets.add("adults");
  assert.ok(sortedVisible().every(isFourAdults));
  state.filters.purchase_gbp={min:"",max:"15000"};
  assert.ok(sortedVisible().every(c=>c.purchase_gbp<=15000));
  state.presets.clear();state.filters={};
});

test("monthly sorting is expensive-first by default, numeric range filters work",()=>{
  const sorted=sortedVisible();
  assert.equal(sorted[0].name,"Aston Martin V8 Vantage 4.7");
  assert.ok(sorted.every((c,i)=>i===0||sorted[i-1].monthly>=c.monthly));
  state.filters.monthly={min:"400",max:"500"};
  assert.ok(sortedVisible().every(c=>c.monthly>=400&&c.monthly<=500));
  state.filters={};
});

test("CSV parser rejects corrupt rows",()=>{
  assert.throws(()=>csvParse("name,mpg_uk\na"),/Invalid CSV row/);
});
