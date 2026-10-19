const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
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
const safeCar=r=>({id:r.id,brand:r.brand,model:r.model,year:r.year,km:r.km,price:r.price,city:r.city,fuel:r.fuel,gear:r.gear,description:r.description,phone:r.phone,photo_key:r.photo_key,photos:r.photos||[],created_at:r.created_at,seller:r.seller,seller_id:r.user_id,category:r.category||"",customs:r.customs||""});
export default {async fetch(req,env){const url=new URL(req.url),p=url.pathname,method=req.method;
if(p==='/api/health')return out({ok:true,project:'AutoShitje',database:!!env.DB,mode:'accounts-and-listings',photos:!!env.PHOTOS,build:'pbkdf2-worker-fix'});
if(p==='/sitemap.xml'){
 const origin=url.origin;let locs=[origin+'/'];
 if(env.DB){try{const [a,d]=await Promise.all([env.DB.prepare("SELECT id FROM as_cars WHERE status='active' ORDER BY created_at DESC LIMIT 2000").all(),env.DB.prepare('SELECT slug FROM as_dealer_profiles WHERE slug IS NOT NULL LIMIT 500').all()]);locs.push(...(a.results||[]).map(x=>origin+'/vetura/'+encodeURIComponent(x.id)),...(d.results||[]).map(x=>origin+'/autosallon/'+encodeURIComponent(x.slug)))}catch(e){console.error('sitemap',e)}}
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+locs.map(x=>'<url><loc>'+x.replace(/&/g,'&amp;')+'</loc></url>').join('')+'</urlset>';
 return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=900'}});
}
if(/^\/(vetura|autosallon)\/[a-z0-9-]+$/.test(p)){
 const res=await env.ASSETS.fetch(new Request(new URL('/index.html',url),req));if(!env.DB||!res.ok)return res;
 let title='AutoShitje — Platforma e veturave',description='Shiko shpallje veturash dhe autosallone në Kosovë.';
 try{if(p.startsWith('/vetura/')){const c=await env.DB.prepare("SELECT brand,model,year,price,city FROM as_cars WHERE id=? AND status='active'").bind(p.split('/')[2]).first();if(c){title=`${c.brand} ${c.model} ${c.year} — AutoShitje`;description=`${c.brand} ${c.model}, viti ${c.year}, ${c.price} €, ${c.city}. Shiko shpalljen në AutoShitje.`}}else{const d=await env.DB.prepare('SELECT u.name,p.city FROM as_dealer_profiles p JOIN as_users u ON u.id=p.user_id WHERE p.slug=?').bind(p.split('/')[2]).first();if(d){title=`${d.name} — AutoShitje`;description=`Shiko veturat e autosallonit ${d.name}, ${d.city||'Kosovë'}, në AutoShitje.`}}}catch(e){console.error('metadata',e)}
 const html=(await res.text()).replace(/<title>[^<]*<\/title>/,`<title>${title.replace(/[&<>"']/g,'')}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${description.replace(/[&<>"']/g,'')}">`);
 return new Response(html,{status:res.status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60'}});
}
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
// Account security and owner-only administration.
if(p==='/api/auth/change-password'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 const b=await body(req);if(!b)return out({error:'Kërkesë e pavlefshme.'},400);
 const next=String(b.newPassword||'');if(next.length<12||next.length>128)return out({error:'Fjalëkalimi i ri duhet të ketë 12–128 karaktere.'},400);
 const r=await env.DB.prepare('SELECT password_hash,salt FROM as_users WHERE id=?').bind(u.id).first();
 if(!r||await hash(String(b.currentPassword||''),r.salt)!==r.password_hash)return out({error:'Fjalëkalimi aktual është gabim.'},403);
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
 await env.DB.batch([env.DB.prepare('UPDATE as_users SET password_hash=?,salt=? WHERE id=?').bind(await hash(next,salt),salt,u.id),env.DB.prepare('DELETE FROM as_sessions WHERE user_id=?').bind(u.id)]);
 return out({ok:true,message:'Fjalëkalimi u ndryshua. Kyçu përsëri.'},200,{'set-cookie':sessionCookie('',0)});
}
if((p==='/api/auth/forgot-password'||p==='/api/auth/reset-password')&&method==='POST')return out({error:'Rikthimi me email nuk është aktivizuar.'},503);
if(p.startsWith('/api/admin/')){
 const u=await user(req,env.DB);if(!u||u.is_admin!==1)return out({error:'Vetëm administratori.'},403);
 if(p==='/api/admin/summary'&&method==='GET'){
  const [users,cars,dealers]=await Promise.all([env.DB.prepare('SELECT COUNT(*) AS n FROM as_users').first(),env.DB.prepare('SELECT COUNT(*) AS n FROM as_cars').first(),env.DB.prepare("SELECT COUNT(*) AS n FROM as_users WHERE role='autosallon'").first()]);return out({users:users.n,cars:cars.n,dealers:dealers.n});
 }
 if(p==='/api/admin/users'&&method==='GET'){
  const r=await env.DB.prepare('SELECT id,name,email,role,is_admin,created_at FROM as_users ORDER BY created_at DESC LIMIT 200').all();return out({users:r.results||[]});
 }
 if(p==='/api/admin/cars'&&method==='GET'){
  const r=await env.DB.prepare('SELECT c.id,c.brand,c.model,c.status,c.created_at,u.email FROM as_cars c JOIN as_users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 200').all();return out({cars:r.results||[]});
 }
 const carMatch=p.match(/^\/api\/admin\/cars\/([0-9a-f-]{36})\/status$/);
 if(carMatch&&method==='POST'){
  const b=await body(req);if(!['active','deleted'].includes(b?.status))return out({error:'Status i pavlefshëm.'},400);
  const r=await env.DB.prepare('UPDATE as_cars SET status=? WHERE id=?').bind(b.status,carMatch[1]).run();return out({ok:true,changed:r.meta.changes});
 }
 return out({error:'Endpoint not found'},404);
}

if(p==='/api/account/delete-request'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 await env.DB.prepare('INSERT OR IGNORE INTO as_deletion_requests (user_id) VALUES (?)').bind(u.id).run();return out({ok:true,message:'Kërkesa u regjistrua.'});
}
if(p==='/api/favorites'&&method==='GET'){
 const u=await user(req,env.DB);if(!u)return out({ids:[]});
 const r=await env.DB.prepare('SELECT car_id FROM as_favorites WHERE user_id=?').bind(u.id).all();return out({ids:(r.results||[]).map(x=>x.car_id)});
}
if(p==='/api/favorites'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);
 if(!/^[0-9a-f-]{36}$/.test(String(b?.carId||'')))return out({error:'Vetura nuk është valide.'},400);
 if(b.saved)await env.DB.prepare("INSERT OR IGNORE INTO as_favorites (user_id,car_id) SELECT ?,id FROM as_cars WHERE id=? AND status='active'").bind(u.id,b.carId).run();
 else await env.DB.prepare('DELETE FROM as_favorites WHERE user_id=? AND car_id=?').bind(u.id,b.carId).run();return out({ok:true});
}
if(p==='/api/dealer/profile'&&method==='GET'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet.'},403);
 const profile=await env.DB.prepare('SELECT * FROM as_dealer_profiles WHERE user_id=?').bind(u.id).first();return out({profile:profile||{}});
}
if(p==='/api/dealer/profile'&&method==='POST'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet.'},403);const b=await body(req);if(!b)return out({error:'Kërkesë e pavlefshme.'},400);
 const slug=str(b.slug,65).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return out({error:'Linku lejon vetëm shkronja a-z, numra dhe vizë.'},400);
 const vals=[str(b.address,200),str(b.city,70),str(b.phone,35),str(b.whatsapp,35),str(b.hours,160),str(b.instagram,220),str(b.facebook,220),str(b.logo_url,300),str(b.cover_url,300)];
 for(const x of vals.slice(7)){if(x&&!/^https:\/\/[^\s]+$/i.test(x))return out({error:'Fotot duhet të jenë lidhje HTTPS.'},400)}
 try{await env.DB.prepare(`INSERT INTO as_dealer_profiles (user_id,slug,address,city,phone,whatsapp,hours,instagram,facebook,logo_url,cover_url) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET slug=excluded.slug,address=excluded.address,city=excluded.city,phone=excluded.phone,whatsapp=excluded.whatsapp,hours=excluded.hours,instagram=excluded.instagram,facebook=excluded.facebook,logo_url=excluded.logo_url,cover_url=excluded.cover_url`).bind(u.id,slug,...vals).run()}
 catch(e){if(String(e).includes('UNIQUE'))return out({error:'Ky link përdoret nga një autosallon tjetër.'},409);throw e}return out({ok:true,slug});
}
if(p==='/api/admin/dealers'&&method==='GET'){
 const u=await user(req,env.DB);if(!u||u.is_admin!==1)return out({error:'Vetëm administratori.'},403);
 const r=await env.DB.prepare("SELECT u.id,u.name,COALESCE(p.featured,0) featured FROM as_users u LEFT JOIN as_dealer_profiles p ON p.user_id=u.id WHERE u.role='autosallon' ORDER BY u.name").all();return out({dealers:r.results||[]});
}
if(p==='/api/admin/dealers/featured'&&method==='POST'){
 const u=await user(req,env.DB);if(!u||u.is_admin!==1)return out({error:'Vetëm administratori.'},403);const b=await body(req);
 if(!/^[0-9a-f-]{36}$/.test(String(b?.id||'')))return out({error:'ID i pavlefshëm'},400);
 await env.DB.prepare("INSERT INTO as_dealer_profiles (user_id,slug,featured) SELECT id,lower(replace(name,' ','-'))||'-'||substr(id,1,6),? FROM as_users WHERE id=? AND role='autosallon' ON CONFLICT(user_id) DO UPDATE SET featured=excluded.featured").bind(b.featured?1:0,b.id).run();return out({ok:true});
}
if(p==='/api/admin/delete-requests'&&method==='GET'){
 const u=await user(req,env.DB);if(!u||u.is_admin!==1)return out({error:'Vetëm administratori.'},403);
 const r=await env.DB.prepare('SELECT r.user_id,r.created_at,u.name,u.email FROM as_deletion_requests r JOIN as_users u ON u.id=r.user_id ORDER BY r.created_at DESC').all();return out({requests:r.results||[]});
}
if(p==='/api/dealers'&&method==='GET'){
 const r=await env.DB.prepare("SELECT u.id,u.name,COUNT(c.id) AS car_count,p.slug,p.address,p.city,p.phone,p.whatsapp,p.hours,p.instagram,p.facebook,p.logo_url,p.cover_url,COALESCE(p.featured,0) featured FROM as_users u LEFT JOIN as_cars c ON c.user_id=u.id AND c.status='active' LEFT JOIN as_dealer_profiles p ON p.user_id=u.id WHERE u.role='autosallon' GROUP BY u.id,u.name ORDER BY featured DESC,car_count DESC,u.name ASC LIMIT 200").all();return out({dealers:r.results||[]});
}
async function attachPhotos(rows){if(!rows.length)return rows;const ids=rows.map(x=>x.id);const marks=ids.map(()=>'?').join(',');const found=await env.DB.prepare(`SELECT car_id,photo_key FROM as_car_photos WHERE car_id IN (${marks}) ORDER BY position ASC,created_at ASC`).bind(...ids).all();const by=new Map();for(const x of found.results||[]){if(!by.has(x.car_id))by.set(x.car_id,[]);by.get(x.car_id).push(x.photo_key)}return rows.map(r=>({...r,photos:by.get(r.id)|| (r.photo_key?[r.photo_key]:[])}))}
if(p==='/api/cars'&&method==='GET'){
 const limit=Math.min(500,Math.max(1,Number(url.searchParams.get('limit'))||48));let sql='SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON c.user_id=u.id WHERE c.status=\'active\'';const args=[];
 const dealer=str(url.searchParams.get('dealer'),36);if(dealer&&/^[0-9a-f-]{36}$/.test(dealer)){sql+=' AND c.user_id=?';args.push(dealer)}for(const k of ['brand','model','city','fuel','gear','category','customs']){const v=str(url.searchParams.get(k),70);if(v){sql+=` AND c.${k}=?`;args.push(v)}}for(const [key,op] of [['minPrice','>='],['maxPrice','<='],['minYear','>='],['maxYear','<='],['maxKm','<=']]){const val=url.searchParams.get(key);if(val!==null&&val!==''&&Number.isFinite(Number(val))){sql+=' AND c.'+({minPrice:'price',maxPrice:'price',minYear:'year',maxYear:'year',maxKm:'km'}[key])+op+'?';args.push(Number(val))}}sql+=' ORDER BY c.created_at DESC LIMIT ?';args.push(limit);
 const result=await env.DB.prepare(sql).bind(...args).all();return out({cars:(await attachPhotos(result.results||[])).map(safeCar)});
}
if(p==='/api/cars/mine'&&method==='GET'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.created_at DESC').bind(u.id).all();return out({cars:(await attachPhotos(r.results||[])).map(safeCar)})}
if(p==='/api/cars'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);if(!b)return out({error:'Invalid request'},400);
 const brand=str(b.brand,70),model=str(b.model,70),city=str(b.city,70),year=Number(b.year),km=Number(b.km),price=Number(b.price),phone=str(b.phone,35),fuel=str(b.fuel,40),gear=str(b.gear,40),description=str(b.description,2500);
 if(!brand||!model||!city||!phone||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1||!Number.isInteger(km)||km<0||km>3000000||!Number.isFinite(price)||price<=0||price>10000000)return out({error:'Kontrollo të dhënat e veturës.'},400);
 const category=str(b.category,35),customs=str(b.customs,45);
 if(!['','SUV','Sedan','Hatchback','Coupe','Karavan','Pickup','Minivan','Cabrio','Tjetër'].includes(category)||!['','Me doganë të paguar','Pa doganë','Me regjistrim RKS'].includes(customs))return out({error:'Kategori ose status dogane i pavlefshëm.'},400);
 const dup=await env.DB.prepare("SELECT id FROM as_cars WHERE user_id=? AND lower(brand)=lower(?) AND lower(model)=lower(?) AND year=? AND km=? AND price=? AND status='active' LIMIT 1").bind(u.id,brand,model,year,km,price).first();if(dup)return out({error:'Kjo veturë duket se është publikuar tashmë në llogarinë tënde.'},409);
 const cid=id();await env.DB.prepare('INSERT INTO as_cars (id,user_id,brand,model,year,km,price,city,fuel,gear,phone,description,category,customs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,u.id,brand,model,year,km,price,city,fuel,gear,phone,description,category,customs).run();return out({ok:true,id:cid},201)
}
const m=p.match(/^\/api\/cars\/([0-9a-f-]{36})$/);if(m&&method==='DELETE'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare('UPDATE as_cars SET status=\'deleted\' WHERE id=? AND user_id=?').bind(m[1],u.id).run();return out({ok:true,changed:r.meta.changes})}
const mainPhoto=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/main-photo$/);
if(mainPhoto&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 const b=await body(req),position=Number(b?.position);if(!Number.isInteger(position)||position<0||position>9)return out({error:'Fotografi e pavlefshme.'},400);
 const own=await env.DB.prepare("SELECT id FROM as_cars WHERE id=? AND user_id=? AND status='active'").bind(mainPhoto[1],u.id).first();if(!own)return out({error:'Shpallja nuk u gjet.'},404);
 const pics=await env.DB.prepare('SELECT photo_key FROM as_car_photos WHERE car_id=? ORDER BY position ASC,created_at ASC').bind(mainPhoto[1]).all();const keys=(pics.results||[]).map(x=>x.photo_key);if(!keys[position])return out({error:'Fotografia nuk u gjet.'},404);
 // Reorder positions so the selected photo becomes first, including the image used by cards.
 const updates=keys.map((key,i)=>env.DB.prepare('UPDATE as_car_photos SET position=? WHERE car_id=? AND photo_key=?').bind(i===position?-1:i+1,mainPhoto[1],key));
 await env.DB.batch(updates);await env.DB.prepare('UPDATE as_cars SET photo_key=? WHERE id=?').bind(keys[position],mainPhoto[1]).run();return out({ok:true});
}
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
 const index=Number(photo[2]||0);const pic=await env.DB.prepare('SELECT photo_key FROM as_car_photos WHERE car_id=? ORDER BY position ASC,created_at ASC LIMIT 1 OFFSET ?').bind(photo[1],index).first();const key=pic?.photo_key||(index===0?car.photo_key:null);if(!key)return out({error:'Photo missing'},404);const obj=await env.PHOTOS.get(key);if(!obj)return out({error:'Photo missing'},404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}})
}
return out({error:'Endpoint not found'},404);
}catch(e){console.error('AutoShitje API error:',e);return out({error:'Server error. Kontrollo log-et.'},500)}
}};
