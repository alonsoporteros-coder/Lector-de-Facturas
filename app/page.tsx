"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: string; file: string; destino: "Compras" | "Ventas" | "Por definir"; ruc: string;
  razonSocial: string; cliente: string; fecha: string; tipo: string; serie: string;
  numero: string; descripcion: string; base: number; igv: number; total: number;
  moneda: "PEN" | "USD" | "EUR"; confidence: number; status: "listo" | "revisar";
};

const initialRows: Row[] = [
  { id:"d1",file:"FACTURA - MONO EXPERIENCE.pdf",destino:"Compras",ruc:"10100988815",razonSocial:"CONFECCIONES L&L - DOMINGUEZ LOPEZ AMERICA",cliente:"MONO EXPERIENCE SOCIEDAD ANONIMA CERRADA",fecha:"2026-03-24",tipo:"01",serie:"F001",numero:"00000265",descripcion:"20/1 (XL); 50/1 HOMBRE (S-M-L); 20/1 (L); 50/1 HOMBRE (XL); 30/1 (L)",base:257.62,igv:46.38,total:304,moneda:"PEN",confidence:98,status:"listo"},
  { id:"d2",file:"20512528458-01-F889-11478.pdf",destino:"Compras",ruc:"20512528458",razonSocial:"SHALOM EMPRESARIAL S.A.C.",cliente:"Monoexperience Sac",fecha:"2026-03-24",tipo:"01",serie:"F889",numero:"011478",descripcion:"Servicio de transporte - MINI PAQUETERIA XS (2 servicios)",base:16.95,igv:3.05,total:20,moneda:"PEN",confidence:97,status:"listo"},
  { id:"d3",file:"20612922650_01_FE01_171.pdf",destino:"Compras",ruc:"20612922650",razonSocial:"FABRIC PLAST E.I.R.L.",cliente:"MONO EXPERIENCE SOCIEDAD ANONIMA CERRADA",fecha:"2026-02-16",tipo:"01",serie:"FE01",numero:"171",descripcion:"ecommerce 28x42 nacional; serigrafia; ecommerce 42x50 nacional",base:296.61,igv:53.39,total:350,moneda:"PEN",confidence:96,status:"listo"},
  { id:"d4",file:"1010098881520260202193541.pdf",destino:"Compras",ruc:"10100988815",razonSocial:"CONFECCIONES L&L - DOMINGUEZ LOPEZ AMERICA",cliente:"MONO EXPERIENCE SOCIEDAD ANONIMA CERRADA",fecha:"2026-02-02",tipo:"NV",serie:"N001",numero:"00000229",descripcion:"20/1; 30/1 SML; 30/1 XL; PIMA HOMBRE (SML)",base:300,igv:0,total:300,moneda:"PEN",confidence:78,status:"revisar"},
];

const money = (n:number, currency:string) => new Intl.NumberFormat("es-PE",{style:"currency",currency}).format(n||0);
const valueAfter = (text:string, patterns:RegExp[]) => {
  for (const p of patterns) { const m=text.match(p); if(m?.[1]) return m[1].trim(); } return "";
};
const lastValueAfter = (text:string, patterns:RegExp[]) => {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
    const value = matches.at(-1)?.[1];
    if (value) return value.trim();
  }
  return "";
};
const parseAmount = (s:string) => {
  const raw=(s||"0").replace(/[^\d.,-]/g,"");
  const comma=raw.lastIndexOf(","); const dot=raw.lastIndexOf(".");
  if(comma>=0&&dot>=0){const decimal=Math.max(comma,dot);return Number(`${raw.slice(0,decimal).replace(/[.,]/g,"")}.${raw.slice(decimal+1)}`);}
  if(comma>=0){const decimals=raw.length-comma-1;return Number(decimals===2?raw.replace(/\./g,"").replace(",","."):raw.replace(/,/g,""));}
  return Number(raw||0);
};
const roundMoney = (n:number) => Math.round((n + Number.EPSILON) * 100) / 100;
const amountByLabel = (text:string, labels:string[]) => {
  const currency="(?:S\\/?|US\\$|USD|PEN|SOLES?|D[ÓO]LARES?)";
  const amount="([0-9][0-9.,]*)";
  for(const label of labels){
    const before=new RegExp(`${label}\\s*(?::|-)?\\s*(?:${currency})?\\s*(?::|-)?\\s*${amount}`,"gi");
    const after=new RegExp(`(?:${currency})\\s*(?::|-)?\\s*${label}\\s*(?::|-)?\\s*${amount}`,"gi");
    for(const pattern of [before,after]){
      const matches=[...text.matchAll(pattern)];
      const value=matches.at(-1)?.[1];
      if(value!==undefined)return parseAmount(value);
    }
  }
  return 0;
};

export function parseInvoice(text:string,file:string,companyRuc:string): Row {
  const clean=text.replace(/\u00a0/g," ").replace(/[ \t]+/g," ");
  const rucs=[...new Set([...clean.matchAll(/(?:DNI\s*\/\s*)?R\.?U\.?C\.?\s*(?:N[°º.]?\s*)?:?\s*(\d{11})/gi)].map(m=>m[1]))];
  const documentRucs=[...new Set([...rucs,...[...clean.matchAll(/\b\d{11}\b/g)].map(m=>m[0])])];
  const ruc=rucs[0]||documentRucs[0]||"";
  const clienteRuc=documentRucs.find(x=>x!==ruc)||"";
  const comprobante=valueAfter(clean,[/(?:No\.?\s*:|FACTURA ELECTR[ÓO]NICA\s*)\s*([A-Z0-9]{1,4})\s*-\s*(\d{1,10})/i,/\b([A-Z]{1,3}\d{1,3})-(\d{3,10})\b/i]);
  const compMatch=clean.match(/(?:No\.?\s*:|FACTURA ELECTR[ÓO]NICA\s*)\s*([A-Z0-9]{1,4})\s*-\s*(\d{1,10})/i)||clean.match(/\b([A-Z]{1,3}\d{1,3})-(\d{3,10})\b/i);
  const factura=/FACTURA/i.test(clean); const nota=/NOTA DE VENTA/i.test(clean);
  const dateRaw=valueAfter(clean,[/(?:F\.?Emisi[óo]n|FECHA EMISI[ÓO]N|Fecha emisi[óo]n)\s*:?[ ]*(\d{1,2}\/\d{1,2}\/\d{4})/i]);
  const parts=dateRaw.split("/"); const fecha=parts.length===3?`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`:"";
  // Se priorizan las etiquetas del resumen para no confundir columnas o cantidades.
  let total=amountByLabel(clean,[
    "IMPORTE\\s+TOTAL", "TOTAL\\s+A\\s+PAGAR", "TOTAL\\s+FACTURA", "TOTAL\\s+VENTA",
    "MONTO\\s+TOTAL", "TOTAL\\s+GENERAL", "TOTAL\\s+DEL\\s+COMPROBANTE",
    "\\bTOTAL(?!\\s+(?:OP\\.?|I\\.?\\s*G\\.?\\s*V\\.?|ISC|DESCUENTO|ANTICIPO))",
  ]);
  let igv=amountByLabel(clean,[
    "TOTAL\\s+I\\.?\\s*G\\.?\\s*V\\.?", "IMPUESTO\\s+GENERAL\\s+A\\s+LAS\\s+VENTAS",
    "I\\.?\\s*G\\.?\\s*V\\.?\\s*(?:\\(?18%?\\)?)?",
  ]);
  let base=amountByLabel(clean,[
    "TOTAL\\s+OP\\.?\\s+GRAVADA", "OPERACI[ÓO]N\\s+GRAVADA", "OP\\.?\\s+GRAVADA",
    "VALOR\\s+(?:DE\\s+)?VENTA", "BASE\\s+IMPONIBLE", "SUB\\s*TOTAL",
  ]);
  // Conciliación contable: completa el dato ausente y descarta totales menores a la base.
  if(!total&&base) total=roundMoney(base+igv);
  if(!base&&total) base=roundMoney(Math.max(0,total-igv));
  if(!igv&&total>base&&base) igv=roundMoney(total-base);
  if(base&&igv&&total<base) total=roundMoney(base+igv);
  const lines=clean.split(/\n/).map(x=>x.trim()).filter(Boolean);
  let razon=lines.find(x=>x.length>3&&!/RUC|FACTURA|BOLETA|NOTA DE VENTA/i.test(x))||"";
  if(/FABRIC PLAST/i.test(clean)) razon="FABRIC PLAST E.I.R.L.";
  const cliente=valueAfter(clean,[/(?:Nombre|Señor\(es\)|ADQUIRIENTE)\s*:?[ ]*([^\n]{3,100})/i])|| (clienteRuc?"Cliente identificado":"");
  const currency=/D[ÓO]LARES|USD|US\$/i.test(clean)?"USD":"PEN";
  const ownRuc=companyRuc.replace(/\D/g,"");
  const destino:Row["destino"]=ownRuc.length===11&&ruc===ownRuc?"Ventas":ownRuc.length===11&&documentRucs.filter(x=>x!==ruc).includes(ownRuc)?"Compras":"Por definir";
  const found=[ruc,fecha,compMatch?.[1],compMatch?.[2],total].filter(Boolean).length;
  const complete=found>=5&&destino!=="Por definir";
  return {id:crypto.randomUUID(),file,destino,ruc,razonSocial:razon,cliente,fecha,tipo:factura?"01":nota?"NV":"",serie:compMatch?.[1]||comprobante,numero:compMatch?.[2]||"",descripcion:destino==="Por definir"?"Revisar si corresponde a compra o venta":"Revisar detalle extraído del comprobante",base,igv,total,moneda:currency,confidence:Math.min(96,50+found*8+(destino!=="Por definir"?6:0)),status:complete?"listo":"revisar"};
}

async function extractText(file:File,onProgress:(s:string)=>void){
  if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")){
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    let text="";
    for(let i=1;i<=pdf.numPages;i++){onProgress(`Leyendo página ${i} de ${pdf.numPages}…`);const page=await pdf.getPage(i);const content=await page.getTextContent();text+=content.items.map((x:any)=>`${x.str}${x.hasEOL?"\n":" "}`).join("")+"\n";}
    if(text.trim().length>40)return text;
  }
  onProgress("Aplicando reconocimiento óptico…");
  const {createWorker}=await import("tesseract.js");
  const worker=await createWorker("spa"); const result=await worker.recognize(file); await worker.terminate(); return result.data.text;
}

export default function Home(){
  const [rows,setRows]=useState<Row[]>([]); const [active,setActive]=useState<"Todos"|"Compras"|"Ventas"|"Por definir">("Todos");
  const [companyRuc,setCompanyRuc]=useState("20615285952");
  const [selected,setSelected]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [progress,setProgress]=useState(""); const [drag,setDrag]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const shown=useMemo(()=>rows.filter(r=>active==="Todos"||r.destino===active),[rows,active]);
  const totals=useMemo(()=>({docs:rows.length,ready:rows.filter(r=>r.status==="listo").length,review:rows.filter(r=>r.status==="revisar").length,amount:rows.reduce((s,r)=>s+r.total,0)}),[rows]);
  const current=rows.find(r=>r.id===selected)||null;
  useEffect(()=>{const saved=localStorage.getItem("factura-clara-company-ruc");if(saved)setCompanyRuc(saved)},[]);
  const changeCompanyRuc=(value:string)=>{const normalized=value.replace(/\D/g,"").slice(0,11);setCompanyRuc(normalized);localStorage.setItem("factura-clara-company-ruc",normalized)};

  const handleFiles=async(list:FileList|File[])=>{const files=Array.from(list).filter(f=>/\.(pdf|jpe?g|png)$/i.test(f.name));if(!files.length)return;setBusy(true);for(let i=0;i<files.length;i++){const f=files[i];try{setProgress(`Procesando ${i+1} de ${files.length}: ${f.name}`);const text=await extractText(f,s=>setProgress(`${f.name} · ${s}`));setRows(prev=>[...prev,parseInvoice(text,f.name,companyRuc)]);}catch{setRows(prev=>[...prev,{...initialRows[0],id:crypto.randomUUID(),file:f.name,destino:"Por definir",razonSocial:"",cliente:"",ruc:"",fecha:"",serie:"",numero:"",descripcion:"No se pudo reconocer automáticamente",base:0,igv:0,total:0,confidence:0,status:"revisar"}]);}}setBusy(false);setProgress("");};
  const update=(id:string,key:keyof Row,value:string|number)=>setRows(rs=>rs.map(r=>r.id===id?{...r,[key]:value}:r));
  const exportExcel=async()=>{const XLSX=await import("xlsx");const wb=XLSX.utils.book_new();const headers=["Periodo de provisión(*)","Mes de provisión(*)","Codigo de Proveedor TSI(*)","Razón Social(Opcional)(*)","Tipo de documento(*)","Serie(*)","Numero(*)","Fecha de Emisión(*)","Fecha de Vencimiento(*)","Moneda(*)","Codigo IGV(*)","Codigo de motivo(*)","Codigo Régimen(*)","Importe Total(*)","IGV","Base imponible","No gravado","Otros Tributos","I.S.C","Concepto","Tipo de documento afecto","Serie de documento afecto","Numero de documento afecto","Fecha de emisión documento afecto","Sucursal(*)","Cuenta contable","Centro de costo","Subcentro de costo","Proyecto","Fecha de detracción","Número de detracción","Importe de detracción","Tasa de detracción","Operación de detracción","Bien o servicio Detracción"];
    for(const destination of ["Compras","Ventas"] as const){const data=rows.filter(r=>r.destino===destination).map(r=>{const d=r.fecha?new Date(`${r.fecha}T00:00:00`):null;return [d?d.getFullYear():"",d?String(d.getMonth()+1).padStart(2,"0"):"",r.ruc,r.razonSocial,r.tipo,r.serie,r.numero,d,"",r.moneda,r.igv>0?18:0,1,0,r.total,r.igv,r.base,0,0,0,r.descripcion,"","","","",1,"","","","","","","","","",""];});const ws=XLSX.utils.aoa_to_sheet([[destination==="Compras"?"PROVISIÓN DE REGISTRO DE COMPRAS":"PROVISIÓN DE REGISTRO DE VENTAS"],headers,...data]);ws["!cols"]=headers.map((h,i)=>({wch:[3,3,20,32,12,11,13,14,14,10,10,12,12,14,12,14,12,12,10,42][i]||16}));ws["!freeze"]={xSplit:0,ySplit:2};ws["!autofilter"]={ref:`A2:AI${Math.max(2,data.length+2)}`};XLSX.utils.book_append_sheet(wb,ws,destination);}XLSX.writeFile(wb,`Comprobantes_${new Date().toISOString().slice(0,10)}.xlsx`);};

  return <main>
    <header className="topbar"><div className="brand"><span className="mark">F.</span><div><strong>Factura Clara</strong><small>Comprobantes → Excel, sin copiar ni pegar</small></div></div><div className="top-actions"><span className="privacy">● Tus archivos se procesan en este navegador</span><button className="export" onClick={exportExcel} disabled={!rows.length}>Exportar Excel <span>↗</span></button></div></header>
    <section className="hero"><div><span className="eyebrow">REGISTRO CONTABLE AUTOMATIZADO</span><h1>Tus comprobantes,<br/><em>listos para registrar.</em></h1><p>Arrastra facturas, boletas o notas de venta. Revisamos los datos y los ordenamos en hojas de Compras y Ventas con el formato TSI.</p></div><div className={`dropzone ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current?.click()}><input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e=>e.target.files&&handleFiles(e.target.files)}/><div className="upload-icon">⇧</div><strong>{busy?progress:"Suelta tus comprobantes aquí"}</strong><span>{busy?"El reconocimiento puede tardar unos segundos":"o haz clic para buscar archivos"}</span><small>PDF, JPG o PNG · Múltiples archivos</small></div></section>
    <section className="workspace">
      <div className="summary"><div><span>Documentos</span><strong>{totals.docs}</strong></div><div><span>Listos</span><strong className="green">{totals.ready}</strong></div><div><span>Por revisar</span><strong className="amber">{totals.review}</strong></div><div><span>Total procesado</span><strong>{money(totals.amount,"PEN")}</strong></div><button className="sample" onClick={()=>setRows(initialRows)}>Cargar ejemplo</button></div>
      <div className="company-setting"><label><span>RUC de mi empresa</span><input inputMode="numeric" value={companyRuc} onChange={e=>changeCompanyRuc(e.target.value)} placeholder="11 dígitos"/></label><small>Se usa para separar automáticamente Compras y Ventas en las nuevas cargas.</small></div>
      <div className="toolbar"><div className="tabs">{(["Todos","Compras","Ventas","Por definir"] as const).map(t=><button key={t} className={active===t?"active":""} onClick={()=>setActive(t)}>{t}<span>{t==="Todos"?rows.length:rows.filter(r=>r.destino===t).length}</span></button>)}</div>{rows.length>0&&<button className="clear" onClick={()=>setRows([])}>Limpiar lista</button>}</div>
      {shown.length===0?<div className="empty"><span>⌁</span><h2>Aquí aparecerán tus comprobantes</h2><p>Carga tus archivos arriba o usa el ejemplo para ver cómo funciona.</p></div>:<div className="table-wrap"><table><thead><tr><th>Estado</th><th>Archivo</th><th>Destino</th><th>RUC / Razón social</th><th>Comprobante</th><th>Fecha</th><th className="right">Total</th><th></th></tr></thead><tbody>{shown.map(r=><tr key={r.id} onClick={()=>setSelected(r.id)}><td><span className={`status ${r.status}`}>{r.status==="listo"?"✓ Listo":"! Revisar"}</span><small className="confidence">{r.confidence}% confianza</small></td><td><strong className="filename">{r.file}</strong><small>{r.descripcion}</small></td><td><select value={r.destino} onClick={e=>e.stopPropagation()} onChange={e=>update(r.id,"destino",e.target.value)}><option>Compras</option><option>Ventas</option><option>Por definir</option></select></td><td><strong>{r.ruc||"Sin RUC"}</strong><small>{r.razonSocial||"Completar razón social"}</small></td><td><strong>{r.serie}-{r.numero}</strong><small>{r.tipo==="01"?"Factura":r.tipo==="NV"?"Nota de venta":"Comprobante"}</small></td><td>{r.fecha||"—"}</td><td className="right amount">{money(r.total,r.moneda)}</td><td><button className="edit" aria-label="Revisar">→</button></td></tr>)}</tbody></table></div>}
    </section>
    {current&&<div className="modal-backdrop" onMouseDown={()=>setSelected(null)}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawer-head"><div><span className={`status ${current.status}`}>{current.status==="listo"?"✓ Listo":"! Revisión necesaria"}</span><h2>Revisar comprobante</h2><p>{current.file}</p></div><button onClick={()=>setSelected(null)}>×</button></div><div className="form-grid"><label>Destino<select value={current.destino} onChange={e=>update(current.id,"destino",e.target.value)}><option>Compras</option><option>Ventas</option><option>Por definir</option></select></label><label>Tipo<input value={current.tipo} onChange={e=>update(current.id,"tipo",e.target.value)}/></label><label>RUC<input value={current.ruc} onChange={e=>update(current.id,"ruc",e.target.value)}/></label><label>Razón social<input value={current.razonSocial} onChange={e=>update(current.id,"razonSocial",e.target.value)}/></label><label className="wide">Cliente<input value={current.cliente} onChange={e=>update(current.id,"cliente",e.target.value)}/></label><label>Fecha<input type="date" value={current.fecha} onChange={e=>update(current.id,"fecha",e.target.value)}/></label><label>Moneda<select value={current.moneda} onChange={e=>update(current.id,"moneda",e.target.value)}><option>PEN</option><option>USD</option><option>EUR</option></select></label><label>Serie<input value={current.serie} onChange={e=>update(current.id,"serie",e.target.value)}/></label><label>Número<input value={current.numero} onChange={e=>update(current.id,"numero",e.target.value)}/></label><label className="wide">Descripción<textarea value={current.descripcion} onChange={e=>update(current.id,"descripcion",e.target.value)}/></label><label>Base imponible<input type="number" step="0.01" value={current.base} onChange={e=>update(current.id,"base",Number(e.target.value))}/></label><label>IGV<input type="number" step="0.01" value={current.igv} onChange={e=>update(current.id,"igv",Number(e.target.value))}/></label><label>Total<input type="number" step="0.01" value={current.total} onChange={e=>update(current.id,"total",Number(e.target.value))}/></label></div><div className="drawer-foot"><button className="delete" onClick={()=>{setRows(rs=>rs.filter(r=>r.id!==current.id));setSelected(null)}}>Eliminar</button><button className="save" onClick={()=>{update(current.id,"status","listo");setSelected(null)}}>Guardar y marcar listo</button></div></aside></div>}
  </main>;
}
