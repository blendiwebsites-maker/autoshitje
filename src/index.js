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
const safeCar=r=>({id:r.id,brand:r.brand,model:r.model,year:r.year,km:r.km,price:r.price,city:r.city,fuel:r.fuel,gear:r.gear,description:r.description,phone:r.phone,photo_key:r.photo_key,photos:r.photos||[],created_at:r.created_at,seller:r.seller,seller_id:r.user_id});
export default {async fetch(req,env){const url=new URL(req.url),p=url.pathname,method=req.method;
if(p==='/api/health')return out({ok:true,project:'AutoShitje',database:!!env.DB,mode:'accounts-and-listings',photos:!!env.PHOTOS,build:'pbkdf2-worker-fix'});
if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
if(!env.DB)return out({error:'D1 binding DB missing'},503);
try{
if(method==='POST'&&!sameOrigin(req))return out({error:'Origin not allowed'},403);
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
if(p==='/api/dealers'&&method==='GET'){
 const r=await env.DB.prepare("SELECT u.id,u.name,COUNT(c.id) AS car_count FROM as_users u LEFT JOIN as_cars c ON c.user_id=u.id AND c.status='active' WHERE u.role='autosallon' GROUP BY u.id,u.name ORDER BY car_count DESC,u.name ASC LIMIT 200").all();return out({dealers:r.results||[]});
}
async function attachPhotos(rows){if(!rows.length)return rows;const ids=rows.map(x=>x.id);const marks=ids.map(()=>'?').join(',');const found=await env.DB.prepare(`SELECT car_id,photo_key FROM as_car_photos WHERE car_id IN (${marks}) ORDER BY position ASC,created_at ASC`).bind(...ids).all();const by=new Map();for(const x of found.results||[]){if(!by.has(x.car_id))by.set(x.car_id,[]);by.get(x.car_id).push(x.photo_key)}return rows.map(r=>({...r,photos:by.get(r.id)|| (r.photo_key?[r.photo_key]:[])}))}
if(p==='/api/cars'&&method==='GET'){
 const limit=Math.min(48,Math.max(1,Number(url.searchParams.get('limit'))||24));let sql='SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON c.user_id=u.id WHERE c.status=\'active\'';const args=[];
 for(const k of ['brand','city']){const v=str(url.searchParams.get(k),70);if(v){sql+=` AND c.${k}=?`;args.push(v)}}sql+=' ORDER BY c.created_at DESC LIMIT ?';args.push(limit);
 const result=await env.DB.prepare(sql).bind(...args).all();return out({cars:(await attachPhotos(result.results||[])).map(safeCar)});
}
if(p==='/api/cars/mine'&&method==='GET'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.created_at DESC').bind(u.id).all();return out({cars:(await attachPhotos(r.results||[])).map(safeCar)})}
if(p==='/api/cars'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);if(!b)return out({error:'Invalid request'},400);
 const brand=str(b.brand,70),model=str(b.model,70),city=str(b.city,70),year=Number(b.year),km=Number(b.km),price=Number(b.price),phone=str(b.phone,35),fuel=str(b.fuel,40),gear=str(b.gear,40),description=str(b.description,2500);
 if(!brand||!model||!city||!phone||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1||!Number.isInteger(km)||km<0||km>3000000||!Number.isFinite(price)||price<=0||price>10000000)return out({error:'Kontrollo të dhënat e veturës.'},400);
 const cid=id();await env.DB.prepare('INSERT INTO as_cars (id,user_id,brand,model,year,km,price,city,fuel,gear,phone,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,u.id,brand,model,year,km,price,city,fuel,gear,phone,description).run();return out({ok:true,id:cid},201)
}
const m=p.match(/^\/api\/cars\/([0-9a-f-]{36})$/);if(m&&method==='DELETE'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('UPDATE as_cars SET status=\'deleted\' WHERE id=? AND user_id=?').bind(m[1],u.id).run();return out({ok:true,changed:r.meta.changes})}
const pm=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/photo$/);
if(pm&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);if(!env.PHOTOS)return out({error:'Cloudflare R2 nuk është lidhur ende.'},503);
 const car=await env.DB.prepare('SELECT id FROM as_cars WHERE id=? AND user_id=? AND status=\'active\'').bind(pm[1],u.id).first();if(!car)return out({error:'Shpallja nuk u gjet.'},404);
 const type=req.headers.get('content-type')||'';if(!['image/jpeg','image/png','image/webp'].includes(type))return out({error:'Përdor JPG, PNG ose WebP.'},415);
 const data=await req.arrayBuffer();if(data.byteLength>4*1024*1024||data.byteLength<100)return out({error:'Fotografia duhet të jetë deri në 4 MB.'},413);
 const bytes=new Uint8Array(data);const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:type==='image/png'?bytes[0]===137&&bytes[1]===80:bytes[0]===82&&bytes[1]===73&&bytes[8]===87;
 if(!valid)return out({error:'Format i pavlefshëm.'},415);
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM as_car_photos WHERE car_id=?').bind(pm[1]).first();if(count.n>=10)return out({error:'Maksimumi është 10 fotografi.'},409);
 const key=`cars/${pm[1]}/${id()}`;await env.PHOTOS.put(key,data,{httpMetadata:{contentType:type}});
 try{await env.DB.prepare('INSERT INTO as_car_photos (id,car_id,photo_key,position) VALUES (?,?,?,?)').bind(id(),pm[1],key,count.n).run();if(count.n===0)await env.DB.prepare('UPDATE as_cars SET photo_key=? WHERE id=?').bind(key,pm[1]).run()}catch(e){await env.PHOTOS.delete(key);throw e}return out({ok:true,key,count:count.n+1});
}
const photo=p.match(/^\/api\/photos\/([0-9a-f-]{36})(?:\/([0-9]))?$/);if(photo&&method==='GET'){
 if(!env.PHOTOS)return out({error:'Photos unavailable'},503);const car=await env.DB.prepare("SELECT id,photo_key FROM as_cars WHERE id=? AND status='active'").bind(photo[1]).first();if(!car)return out({error:'Photo missing'},404);
 const index=Number(photo[2]||0);const pic=await env.DB.prepare('SELECT photo_key FROM as_car_photos WHERE car_id=? ORDER BY position ASC,created_at ASC LIMIT 1 OFFSET ?').bind(photo[1],index).first();const key=pic?.photo_key||(index===0?car.photo_key:null);if(!key)return out({error:'Photo missing'},404);const obj=await env.PHOTOS.get(key);if(!obj)return out({error:'Photo missing'},404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}})
}
return out({error:'Endpoint not found'},404);
}catch(e){console.error('AutoShitje API error:',e);return out({error:'Server error. Kontrollo log-et.'},500)}
}};
