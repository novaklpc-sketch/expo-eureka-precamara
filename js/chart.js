/* Gráfico interativo do limite de operação pobre (capítulo 01 da versão 3).
 * Curvas da monografia (scripts/gera_curvas.py, "Fonte: Os autores, 2026", elaboradas com base em
 * Alvarez et al. (2018) e Heywood (2018)): rendimento térmico, NOx relativo e CoV da IMEP em função de λ.
 * Três painéis empilhados, um por grandeza, com um só eixo λ e um cursor comum, movido pela rolagem
 * ou pelo ponteiro. Nenhum valor é medido neste trabalho: o comportamento é qualitativo.
 */
const L0=0.9,L1=1.75;
import {clamp} from './util.js';
import {VELA} from './dados-vela.js';
// fim da varredura medida com a vela original (os autores, 2026): λ 1,4 pela sonda da gestão
const LAM_VELA=VELA.cov.lam[VELA.cov.lam.length-1];
// CoV medido no λ do cursor (interpolação linear entre os pontos); fora da varredura, null
const covMedido=l=>{const L=VELA.cov.lam,C=VELA.cov.cov;if(l<L[0]-.005||l>L[L.length-1]+.005)return null;
 for(let i=1;i<L.length;i++)if(l<=L[i])return C[i-1]+(C[i]-C[i-1])*clamp((l-L[i-1])/(L[i]-L[i-1]),0,1);return C[C.length-1]};
export const curves={
 eta:l=>34+9.5*(l-0.9)-260*Math.max(0,l-1.42)**2,
 nox:l=>100*Math.exp(-((l-1.08)**2)/(2*0.11**2)),
 cov:l=>1.0+0.6*(l-0.9)+260*Math.max(0,l-1.35)**2.4,
};
// limite de operação estável: primeiro λ em que o CoV cruza 5 %
export const LIMIT=(()=>{let l=L0;while(l<L1&&curves.cov(l)<5)l+=.0005;return +l.toFixed(3)})();
export const lambdaAt=p=>0.95+clamp(p,0,1)*(1.72-0.95);

const SVGNS='http://www.w3.org/2000/svg';
export const el=(n,a={},t)=>{const e=document.createElementNS(SVGNS,n);for(const k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e};

export function initLeanChart(host,{static:isStatic=false,onPointer=null}={}){
 const svg=el('svg',{class:'lean-svg',role:'img','aria-labelledby':'lean-svg-title'});
 svg.append(el('title',{id:'lean-svg-title'},'Rendimento térmico, NOx relativo e CoV da IMEP em função do fator lambda, com o limite de operação pobre da literatura e o CoV medido com a vela original até lambda 1,4'));
 host.append(svg);
 const panels=[
  {key:'eta',name:'Rendimento térmico',unit:'%',min:30,max:48,ticks:[32,40,48],fmt:v=>v.toFixed(1).replace('.',',')+' %'},
  {key:'nox',name:'NOx relativo',unit:'%',min:0,max:105,ticks:[0,50,100],fmt:v=>Math.round(v)+' %'},
  {key:'cov',name:'CoV da IMEP',unit:'%',min:0,max:20,ticks:[0,5,10,20],fmt:v=>v.toFixed(1).replace('.',',')+' %'},
 ];
 let W=0,H=0,plot=null,lambda=1.0,pointerLambda=null,layers={};
 const small=()=>W<560;
 function layout(){
  // medida de layout, não de tela: a prancha da cortina é exibida com escala e o desenho deve ser o da caixa final
  W=Math.max(280,Math.round(host.clientWidth));H=Math.max(320,Math.round(host.clientHeight));
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',W);svg.setAttribute('height',H);
  const left=small()?44:56,right=small()?14:26,top=small()?54:62,bottom=34,gap=small()?26:30;
  const ph=(H-top-bottom-gap*(panels.length-1))/panels.length;
  plot={left,right,top,bottom,gap,ph,x:l=>left+(l-L0)/(L1-L0)*(W-left-right)};
  panels.forEach((p,i)=>{p.y0=top+i*(ph+gap);p.y1=p.y0+ph;p.y=v=>p.y1-(clamp(v,p.min,p.max)-p.min)/(p.max-p.min)*ph});
  draw();
 }
 function pathFor(p){
  let d='';for(let i=0;i<=240;i++){const l=L0+(L1-L0)*i/240,x=plot.x(l),y=p.y(curves[p.key](l));d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}return d;
 }
 function draw(){
  while(svg.childNodes.length>1)svg.removeChild(svg.lastChild);
  const g=el('g');svg.append(g);
  const xl=plot.x(LIMIT),xe=plot.x(1.70);
  // região instável (após o limite), em todos os painéis
  panels.forEach(p=>{
   g.append(el('rect',{class:'lean-unstable',x:xl,y:p.y0,width:plot.x(L1)-xl,height:p.y1-p.y0}));
   // eixo y: linhas-guia recessivas e marcas
   p.ticks.forEach(v=>{const y=p.y(v);g.append(el('line',{class:'lean-grid',x1:plot.left,x2:W-plot.right,y1:y,y2:y}));g.append(el('text',{class:'lean-tick',x:plot.left-8,y:y+4,'text-anchor':'end'},String(v)))});
   g.append(el('text',{class:'lean-panel',x:plot.left,y:p.y0-8},`${p.name} (${p.unit})`));
   g.append(el('path',{class:'lean-line',d:pathFor(p)}));
  });
  // limiar do CoV (5 %) e rótulos do limite
  const cov=panels[2];
  g.append(el('line',{class:'lean-threshold',x1:plot.left,x2:W-plot.right,y1:cov.y(5),y2:cov.y(5)}));
  if(!small())g.append(el('text',{class:'lean-note',x:plot.left+6,y:cov.y(5)-6},'corte do CoV · 5 %'));
  // CoV da IMEP medido com a vela original (pontos sobre a curva da literatura)
  const mx=VELA.cov.lam.map(plot.x),my=VELA.cov.cov.map(cov.y);
  g.append(el('path',{class:'lean-meas-line',d:mx.map((x,i)=>(i?'L':'M')+x.toFixed(1)+' '+my[i].toFixed(1)).join('')}));
  mx.forEach((x,i)=>g.append(el('circle',{class:'lean-meas',cx:x,cy:my[i],r:4.5})));
  g.append(el('text',{class:'lean-note lean-note-meas',x:plot.x(1.2),y:Math.min(...my)-12,'text-anchor':'middle'},small()?'medido':'medido com a vela'));
  // fim da varredura medida, em todos os painéis
  const xv=plot.x(LAM_VELA);
  g.append(el('line',{class:'lean-meas-limit',x1:xv,x2:xv,y1:plot.top-6,y2:H-plot.bottom+4}));
  g.append(el('line',{class:'lean-limit',x1:xl,x2:xl,y1:plot.top-6,y2:H-plot.bottom+4}));
  g.append(el('text',{class:'lean-note',x:xl+6,y:cov.y0+14,'text-anchor':'start'},small()?'literatura':'limite, literatura'));
  g.append(el('text',{class:'lean-note lean-note-red',x:(xl+plot.x(L1))/2,y:cov.y(cov.min)-6,'text-anchor':'middle'},small()?'instável':'instável (misfire)'));
  // extensão pretendida com a pré-câmara (painel do rendimento)
  const eta=panels[0],ya=eta.y(45.5);
  g.append(el('line',{class:'lean-arrow',x1:xv+2,x2:xe,y1:ya,y2:ya,'marker-end':'url(#lean-head)'}));
  g.append(el('text',{class:'lean-note lean-note-red',x:(xv+xe)/2,y:ya-7,'text-anchor':'middle'},small()?'extensão pretendida':'extensão pretendida com pré-câmara'));
  g.append(el('text',{class:'lean-note lean-note-meas',x:xv-6,y:ya+4,'text-anchor':'end'},small()?'vela: λ 1,4':'vela, medido: λ 1,4'));
  const defs=el('defs');const m=el('marker',{id:'lean-head',markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto',markerUnits:'userSpaceOnUse'});m.append(el('path',{d:'M0 0 L8 4 L0 8 Z',class:'lean-arrow-head'}));defs.append(m);svg.append(defs);
  // eixo λ
  const yb=H-plot.bottom+4;
  [1.0,1.2,1.4,1.6].forEach(v=>{const x=plot.x(v);g.append(el('line',{class:'lean-grid',x1:x,x2:x,y1:yb,y2:yb+5}));g.append(el('text',{class:'lean-tick',x,y:yb+18,'text-anchor':'middle'},v.toFixed(1).replace('.',',')))});
  g.append(el('text',{class:'lean-axis',x:W-plot.right,y:yb+18,'text-anchor':'end'},'λ →'));
  // camada do cursor
  const c=el('g',{class:'lean-cursor'});svg.append(c);
  layers={group:c,line:el('line',{class:'lean-cursor-line',y1:plot.top-6,y2:H-plot.bottom+4}),dots:[],rings:[],labels:[],lam:el('text',{class:'lean-lambda','text-anchor':'middle'})};
  c.append(layers.line);
  panels.forEach(p=>{const r=el('circle',{class:'lean-ring',r:6});const d=el('circle',{class:'lean-dot',r:5});const t=el('text',{class:'lean-value'});c.append(r,d,t);layers.rings.push(r);layers.dots.push(d);layers.labels.push(t)});
  c.append(layers.lam);
  update();
 }
 function update(){
  if(!plot)return;
  const l=pointerLambda??lambda,x=plot.x(l);
  layers.line.setAttribute('x1',x);layers.line.setAttribute('x2',x);
  panels.forEach((p,i)=>{
   // no painel do CoV, dentro da varredura medida, a leitura é a do ensaio com a vela, não a da curva da literatura
   const m=p.key==='cov'?covMedido(l):null,v=m??curves[p.key](l),y=p.y(v);
   layers.dots[i].setAttribute('cx',x);layers.dots[i].setAttribute('cy',y);layers.rings[i].setAttribute('cx',x);layers.rings[i].setAttribute('cy',y);
   layers.dots[i].classList.toggle('is-meas',m!=null);
   const t=layers.labels[i],flip=x>W-plot.right-90;
   t.setAttribute('x',flip?x-10:x+10);t.setAttribute('y',y-11);t.setAttribute('text-anchor',flip?'end':'start');t.textContent=(m!=null?'medido ':'')+p.fmt(v);
   t.classList.toggle('is-meas',m!=null);
  });
  layers.lam.setAttribute('x',x);layers.lam.setAttribute('y',plot.top-26);layers.lam.textContent='λ = '+l.toFixed(2).replace('.',',');
  svg.classList.toggle('is-unstable',l>=LIMIT);
  host.dataset.lambda=l.toFixed(2);
 }
 // prancha estática (cortina do ato I): só desenha, sem teclado, ponteiro ou região viva
 if(isStatic){new ResizeObserver(layout).observe(host);layout();return {setLambda(l){lambda=clamp(l,L0,L1);update()},setProgress(p){lambda=lambdaAt(p);update()}}}
 // teclado: setas movem λ (Shift acelera), Home/End vão aos extremos; a leitura é anunciada após uma pausa
 host.tabIndex=0;host.setAttribute('role','group');host.setAttribute('aria-label','Gráfico interativo do limite pobre. Use as setas para mover o fator lambda.');
 const live=document.createElement('p');live.className='sr-only';live.setAttribute('role','status');host.after(live);
 let liveT=0;
 const announce=()=>{clearTimeout(liveT);liveT=setTimeout(()=>{const l=pointerLambda??lambda;live.textContent=`λ ${l.toFixed(2).replace('.',',')}: rendimento ${curves.eta(l).toFixed(1).replace('.',',')} %, NOx relativo ${Math.round(curves.nox(l))} %, CoV da IMEP ${(covMedido(l)??curves.cov(l)).toFixed(1).replace('.',',')} %${covMedido(l)!=null?', medido com a vela':''}${l>=LIMIT?', região instável':''}.`},300)};
 host.addEventListener('keydown',e=>{
  const step=e.shiftKey?.1:.01;let l=pointerLambda??lambda;
  if(e.key==='ArrowRight'||e.key==='ArrowUp')l+=step;else if(e.key==='ArrowLeft'||e.key==='ArrowDown')l-=step;
  else if(e.key==='Home')l=L0;else if(e.key==='End')l=L1;else return;
  e.preventDefault();e.stopPropagation();pointerLambda=clamp(l,L0,L1);update();announce();ping();
 });
 host.addEventListener('blur',()=>{pointerLambda=null;update();ping()});
 // ponteiro: move o cursor enquanto estiver sobre o gráfico; avisa quem quiser acompanhar (volta ao texto)
 const ping=()=>{if(onPointer)onPointer(pointerLambda)};
 const toLambda=e=>{const r=svg.getBoundingClientRect();return clamp(L0+((e.clientX-r.left)/r.width*W-plot.left)/(W-plot.left-plot.right)*(L1-L0),L0,L1)};
 svg.addEventListener('pointermove',e=>{pointerLambda=toLambda(e);update();ping()});
 svg.addEventListener('pointerleave',()=>{pointerLambda=null;update();ping()});
 svg.addEventListener('touchstart',e=>{if(e.touches[0]){pointerLambda=toLambda(e.touches[0]);update();ping()}},{passive:true});
 svg.addEventListener('touchmove',e=>{if(e.touches[0]){pointerLambda=toLambda(e.touches[0]);update();ping()}},{passive:true});
 svg.addEventListener('touchend',()=>{pointerLambda=null;update();ping()});
 new ResizeObserver(layout).observe(host);
 layout();
 return {
  setProgress(p){lambda=lambdaAt(p);update()},
  setLambda(l){lambda=clamp(l,L0,L1);update()},
  // chegada guiada pelo texto: anel nos pontos e leve fade nos valores (CSS); cursor vermelho enquanto o texto guia
  pulse(){const g=layers.group;if(!g)return;g.classList.remove('is-arrive');void svg.getBoundingClientRect();g.classList.add('is-arrive')},
  setDriver(d){svg.classList.toggle('is-text',d==='text')},
  load(){},draw(){},sync(){},
 };
}

/* Tabela acessível com valores amostrados das mesmas curvas e o CoV medido com a vela */
export function leanTable(){
 const med=l=>{const i=VELA.cov.lam.findIndex(v=>Math.abs(v-l)<1e-6);return i<0?'–':VELA.cov.cov[i].toFixed(1).replace('.',',')};
 const rows=[1.0,1.1,1.2,1.3,1.4,1.5,1.6,1.7].map(l=>`<tr><th scope="row">${l.toFixed(1).replace('.',',')}</th><td>${curves.eta(l).toFixed(1).replace('.',',')}</td><td>${Math.round(curves.nox(l))}</td><td>${curves.cov(l).toFixed(1).replace('.',',')}</td><td>${med(l)}</td></tr>`).join('');
 return `<table><caption>Curvas da literatura (comportamento qualitativo) e CoV medido com a vela original</caption><thead><tr><th scope="col">λ</th><th scope="col">Rendimento (%)</th><th scope="col">NOx relativo (%)</th><th scope="col">CoV da IMEP (%)</th><th scope="col">CoV medido (%)</th></tr></thead><tbody>${rows}</tbody></table>`;
}
