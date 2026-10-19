const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const out=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...H,...extra}});
const str=(v,n=150)=>String(v??'').trim().slice(0,n);
const id=()=>crypto.randomUUID();
const hex=a=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>new Uint8Array((s.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
// Cloudflare Workers caps a single PBKDF2 call at 100,000 iterations.
// Six sequential domain-separated 100k rounds retain an expensive password check.
// Hash version prefix lets us migrate to a standard managed auth service later.
async function hash(password,salt){
 let material=new TextEncoder().encode(password);
 const saltBytes=unhex(salt);
 for(let round=0;round<6;round++){
  const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
  const roundSalt=new Uint8Array(saltBytes.length+1);
  roundSalt.set(saltBytes);roundSalt[saltBytes.length]=round;
  material=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:roundSalt,iterations:100000,hash:'SHA-256'},key,256));
 }
 return 'v2$'+hex(material);
}
async function sha(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
const cookie=(request)=>Object.fromEntries((request.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=').slice(0,2)).filter(x=>x.length===2));
async function user(req,db){const token=cookie(req).as_session;if(!token)return null;return await db.prepare('SELECT u.id,u.name,u.email,u.role,u.is_admin FROM as_sessions s JOIN as_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > ?').bind(await sha(token),Date.now()).first()}
const sessionCookie=(token,max=604800)=>`as_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${max}`;
async function body(req){if(Number(req.headers.get('content-length')||0)>150000)return null;try{return await req.json()}catch{return null}}
function sameOrigin(req){try{return new URL(req.headers.get('origin')).origin===new URL(req.url).origin}catch{return false}}
const photoKeys=v=>{if(!v)return [];try{const a=JSON.parse(v);if(Array.isArray(a))return a.filter(x=>typeof x==='string').slice(0,8)}catch{}return [v]};
const safeCar=r=>({id:r.id,brand:r.brand,model:r.model,year:r.year,km:r.km,price:r.price,city:r.city,fuel:r.fuel,gear:r.gear,description:r.description,phone:r.phone,photo_count:photoKeys(r.photo_key).length,created_at:r.created_at,seller:r.seller,seller_id:r.user_id});
const validCar=b=>{const v={brand:str(b.brand,70),model:str(b.model,70),city:str(b.city,70),year:Number(b.year),km:Number(b.km),price:Number(b.price),phone:str(b.phone,35),fuel:str(b.fuel,40),gear:str(b.gear,40),description:str(b.description,2500)};return v.brand&&v.model&&v.city&&v.phone&&Number.isInteger(v.year)&&v.year>=1950&&v.year<=new Date().getFullYear()+1&&Number.isInteger(v.km)&&v.km>=0&&v.km<=3000000&&Number.isFinite(v.price)&&v.price>0&&v.price<=10000000?v:null};
const originOk=req=>{const s=req.headers.get('sec-fetch-site');return (!s||s==='same-origin'||s==='none')&&sameOrigin(req)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default {async fetch(req,env){const url=new URL(req.url),p=url.pathname,method=req.method;
if(p==='/api/health')return out({ok:true,project:'AutoShitje',database:!!env.DB,mode:'accounts-and-listings',photos:!!env.PHOTOS,build:'pbkdf2-worker-fix'});
if(p==='/sitemap.xml'&&env.DB){const r=await env.DB.prepare("SELECT id FROM as_cars WHERE status='active' ORDER BY created_at DESC LIMIT 3000").all();const base=url.origin;return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+base+'/</loc></url>'+(r.results||[]).map(c=>'<url><loc>'+base+'/vetura/'+c.id+'</loc></url>').join('')+'</urlset>',{headers:{'content-type':'application/xml; charset=utf-8'}})}
if(/^\/vetura\/[0-9a-f-]{36}$/.test(p)&&env.DB){const car=await env.DB.prepare("SELECT c.*,u.name seller FROM as_cars c JOIN as_users u ON c.user_id=u.id WHERE c.id=? AND c.status='active'").bind(p.split('/')[2]).first();if(!car)return env.ASSETS.fetch(new Request(url.origin+'/404.html'));const title=esc(car.brand+' '+car.model+' '+car.year+' | AutoShitje');const desc=esc(car.city+' · '+car.km+' km · '+car.price+' € · Shpallje veture në Kosovë');const html='<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><meta name="description" content="'+desc+'"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+desc+'"><meta property="og:image" content="'+url.origin+'/api/photos/'+car.id+'"><link rel="canonical" href="'+url.origin+p+'"><link rel="stylesheet" href="/style.css"></head><body><div id="app"></div><script>window.__CAR_ID__='+JSON.stringify(car.id)+'</script><script src="/app.js" defer></script></body></html>';return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff'}})}
if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
if(!env.DB)return out({error:'D1 binding DB missing'},503);
try{
if(['POST','PUT','PATCH','DELETE'].includes(method)&&!originOk(req))return out({error:'Origin not allowed'},403);
if(p==='/api/auth/register'&&method==='POST'){
 const b=await body(req);if(!b)return out({error:'Invalid request'},400);const name=str(b.name,80),email=str(b.email,254).toLowerCase(),pass=String(b.password||''),role=b.role==='autosallon'?'autosallon':'privat';
 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||pass.length<12||pass.length>128)return out({error:'Emri, emaili ose fjalëkalimi nuk është valid (minimumi 12 karaktere).'},400);
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const pw=await hash(pass,salt);const uid=id();
 try{await env.DB.prepare('INSERT INTO as_users (id,name,email,password_hash,salt,role) VALUES (?,?,?,?,?,?)').bind(uid,name,email,pw,salt,role).run()}catch(e){console.error('AutoShitje registration insert failed:',e);if(String(e?.message||'').includes('UNIQUE constraint failed: as_users.email'))return out({error:'Ky email është i regjistruar.'},409);throw e}
 const token=id()+id();await env.DB.prepare('INSERT INTO as_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token),uid,Date.now()+604800000).run();return out({ok:true,user:{id:uid,name,email,role}},201,{'set-cookie':sessionCookie(token)});
}
if(p==='/api/auth/login'&&method==='POST'){
 const b=await body(req);if(!b)return out({error:'Invalid request'},400);const email=str(b.email,254).toLowerCase();const r=await env.DB.prepare('SELECT * FROM as_users WHERE email=?').bind(email).first();if(!r||await hash(String(b.password||''),r.salt)!==r.password_hash)return out({error:'Email ose fjalëkalim i gabuar.'},401);
 const token=id()+id();await env.DB.prepare('INSERT INTO as_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token),r.id,Date.now()+604800000).run();return out({ok:true,user:{id:r.id,name:r.name,email:r.email,role:r.role}},200,{'set-cookie':sessionCookie(token)});
}
if(p==='/api/auth/me'&&method==='GET')return out({user:await user(req,env.DB)});
if(p==='/api/auth/logout'&&method==='POST'){const t=cookie(req).as_session;if(t)await env.DB.prepare('DELETE FROM as_sessions WHERE token_hash=?').bind(await sha(t)).run();return out({ok:true},200,{'set-cookie':sessionCookie('',0)})}
if(p==='/api/cars'&&method==='GET'){
 const limit=Math.min(48,Math.max(1,Number(url.searchParams.get('limit'))||24)),page=Math.min(1000,Math.max(1,Number(url.searchParams.get('page'))||1));
 let sql="SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON c.user_id=u.id WHERE c.status='active'";const args=[];
 for(const k of ['brand','city','fuel','gear']){const v=str(url.searchParams.get(k),70);if(v){sql+=` AND LOWER(c.${k})=LOWER(?)`;args.push(v)}}
 const q=str(url.searchParams.get('q'),80);if(q){sql+=' AND (LOWER(c.brand) LIKE ? OR LOWER(c.model) LIKE ? OR LOWER(c.city) LIKE ?)';args.push(...Array(3).fill('%'+q.toLowerCase()+'%'))}
 for(const [k,op] of [['min_price','>='],['max_price','<='],['min_year','>='],['max_year','<='],['max_km','<=']]){const value=url.searchParams.get(k);if(value!==null&&value!==''&&Number.isFinite(Number(value))){const field=k.includes('price')?'price':k.includes('year')?'year':'km';sql+=` AND c.${field}${op}?`;args.push(Number(value))}}
 const sort=url.searchParams.get('sort');sql+=' ORDER BY '+({price_asc:'c.price ASC',price_desc:'c.price DESC',year_desc:'c.year DESC',km_asc:'c.km ASC'}[sort]||'c.created_at DESC')+', c.id DESC LIMIT ? OFFSET ?';args.push(limit,(page-1)*limit);
 const result=await env.DB.prepare(sql).bind(...args).all();return out({cars:(result.results||[]).map(safeCar),page,has_more:(result.results||[]).length===limit});
}
if(p==='/api/dealers'&&method==='GET'){const r=await env.DB.prepare("SELECT u.id,u.name,u.role,COUNT(c.id) AS listings FROM as_users u LEFT JOIN as_cars c ON c.user_id=u.id AND c.status='active' WHERE u.role='autosallon' GROUP BY u.id,u.name,u.role ORDER BY listings DESC,u.name LIMIT 100").all();return out({dealers:r.results||[]})}
const sellerPath=p.match(/^\/api\/sellers\/([0-9a-f-]{36})$/);if(sellerPath&&method==='GET'){const seller=await env.DB.prepare('SELECT id,name,role,created_at FROM as_users WHERE id=?').bind(sellerPath[1]).first();if(!seller)return out({error:'Shitësi nuk u gjet.'},404);const r=await env.DB.prepare("SELECT c.*,u.name seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.user_id=? AND c.status='active' ORDER BY c.created_at DESC LIMIT 48").bind(seller.id).all();return out({seller,cars:(r.results||[]).map(safeCar)})}
const detail=p.match(/^\/api\/cars\/([0-9a-f-]{36})$/);if(detail&&method==='GET'){const r=await env.DB.prepare("SELECT c.*,u.name seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.id=? AND c.status='active'").bind(detail[1]).first();if(!r)return out({error:'Vetura nuk u gjet.'},404);return out({car:safeCar(r)})}
if(p==='/api/cars/mine'&&method==='GET'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.created_at DESC').bind(u.id).all();return out({cars:(r.results||[]).map(safeCar)})}
if(p==='/api/cars'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);if(!b)return out({error:'Invalid request'},400);
 const brand=str(b.brand,70),model=str(b.model,70),city=str(b.city,70),year=Number(b.year),km=Number(b.km),price=Number(b.price),phone=str(b.phone,35),fuel=str(b.fuel,40),gear=str(b.gear,40),description=str(b.description,2500);
 if(!brand||!model||!city||!phone||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1||!Number.isInteger(km)||km<0||km>3000000||!Number.isFinite(price)||price<=0||price>10000000)return out({error:'Kontrollo të dhënat e veturës.'},400);
 const cid=id();await env.DB.prepare('INSERT INTO as_cars (id,user_id,brand,model,year,km,price,city,fuel,gear,phone,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,u.id,brand,model,year,km,price,city,fuel,gear,phone,description).run();return out({ok:true,id:cid},201)
}
const edit=p.match(/^\/api\/cars\/([0-9a-f-]{36})$/);if(edit&&method==='PUT'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);if(!b)return out({error:'Invalid request'},400);const v=validCar(b);if(!v)return out({error:'Kontrollo të dhënat e veturës.'},400);
 const r=await env.DB.prepare("UPDATE as_cars SET brand=?,model=?,year=?,km=?,price=?,city=?,fuel=?,gear=?,phone=?,description=? WHERE id=? AND user_id=? AND status='active'").bind(v.brand,v.model,v.year,v.km,v.price,v.city,v.fuel,v.gear,v.phone,v.description,edit[1],u.id).run();return out({ok:!!r.meta.changes,changed:r.meta.changes},r.meta.changes?200:404)
}
const m=p.match(/^\/api\/cars\/([0-9a-f-]{36})$/);if(m&&method==='DELETE'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('UPDATE as_cars SET status=\'deleted\' WHERE id=? AND user_id=?').bind(m[1],u.id).run();return out({ok:true,changed:r.meta.changes})}
const pm=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/photo$/);
if(pm&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);if(!env.PHOTOS)return out({error:'Cloudflare R2 nuk është lidhur ende.'},503);
 const car=await env.DB.prepare('SELECT id,photo_key FROM as_cars WHERE id=? AND user_id=? AND status=\'active\'').bind(pm[1],u.id).first();if(!car)return out({error:'Shpallja nuk u gjet.'},404);
 const type=req.headers.get('content-type')||'';if(!['image/jpeg','image/png','image/webp'].includes(type))return out({error:'Përdor JPG, PNG ose WebP.'},415);
 const data=await req.arrayBuffer();if(data.byteLength>4*1024*1024||data.byteLength<100)return out({error:'Fotografia duhet të jetë deri në 4 MB.'},413);
 const bytes=new Uint8Array(data);const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:type==='image/png'?bytes[0]===137&&bytes[1]===80:bytes[0]===82&&bytes[1]===73&&bytes[8]===87;
 if(!valid)return out({error:'Format i pavlefshëm.'},415);
 const current=photoKeys(car.photo_key);if(current.length>=8)return out({error:'Maksimum 8 fotografi për shpallje.'},400);const key=`cars/${pm[1]}/${id()}`;await env.PHOTOS.put(key,data,{httpMetadata:{contentType:type}});await env.DB.prepare('UPDATE as_cars SET photo_key=? WHERE id=? AND user_id=?').bind(JSON.stringify([...current,key]),pm[1],u.id).run();return out({ok:true,key,count:current.length+1});
}
const photo=p.match(/^\/api\/photos\/([0-9a-f-]{36})(?:\/(\d+))?$/);if(photo&&method==='GET'){
 if(!env.PHOTOS)return out({error:'Photos unavailable'},503);const car=await env.DB.prepare('SELECT photo_key FROM as_cars WHERE id=? AND status=\'active\'').bind(photo[1]).first();if(!car?.photo_key)return out({error:'Photo missing'},404);const keys=photoKeys(car.photo_key);const idx=Number(photo[2]||0);if(!Number.isInteger(idx)||idx<0||idx>=keys.length)return out({error:'Photo missing'},404);const obj=await env.PHOTOS.get(keys[idx]);if(!obj)return out({error:'Photo missing'},404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}})
}
return out({error:'Endpoint not found'},404);
}catch(e){console.error('AutoShitje API error:',e);return out({error:'Server error. Kontrollo log-et.'},500)}
}};
