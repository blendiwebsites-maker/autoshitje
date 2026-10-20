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
const safeCar=r=>({id:r.id,brand:r.brand,model:r.model,year:r.year,km:r.km,price:r.price,city:r.city,fuel:r.fuel,gear:r.gear,description:r.description,phone:r.phone,photo_key:r.photo_key,photos:r.photos||[],created_at:r.created_at,seller:r.seller,seller_id:r.user_id,category:r.category||"",customs:r.customs||"",status:r.status||"active",pinned:Number(r.pinned||0)===1});
export default {async fetch(req,env){const url=new URL(req.url),p=url.pathname,method=req.method;
if(p==='/api/health')return out({ok:true,project:'AutoShitje',database:!!env.DB,mode:'accounts-and-listings',photos:!!env.PHOTOS,build:'pbkdf2-worker-fix'});
// Public SEO brand landing pages; only a curated, finite list is indexable.
const brandPages={'volkswagen':'Volkswagen','mercedes-benz':'Mercedes','bmw':'BMW','audi':'Audi','skoda':'Skoda','toyota':'Toyota','ford':'Ford','opel':'Opel','renault':'Renault','peugeot':'Peugeot','hyundai':'Hyundai','kia':'Kia','seat':'Seat','nissan':'Nissan','honda':'Honda','volvo':'Volvo','fiat':'Fiat','dacia':'Dacia','mazda':'Mazda','tesla':'Tesla','porsche':'Porsche','land-rover':'LandRover','jaguar':'Jaguar'};
const brandSlug=p.match(/^\/vetura\/marka\/([a-z0-9-]+)$/);
if(brandSlug){
 const brand=brandPages[brandSlug[1]];
 if(!brand)return new Response('Not found',{status:404});
 const page=await env.ASSETS.fetch(new Request(new URL('/',url),req));
 if(!page.ok)return page;
 // Empty brand pages must not be indexed.
 let count=0;
 try{if(env.DB){const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM as_cars WHERE status='active' AND lower(brand)=lower(?)").bind(brand).first();count=Number(r?.n||0)}}catch(e){console.error('brand SEO count',e)}
 const title=`${brand} në shitje në Kosovë | AutoShitje`;
 const description=`Shiko ${brand} në shitje në Kosovë. Krahaso çmimet, vitet dhe kilometrat në AutoShitje.`;
 const escapeHtml=x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const html=(await page.text()).replace(/<title>[^<]*<\/title>/,`<title>${escapeHtml(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escapeHtml(description)}">`);
 return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60',...(count?{}:{'x-robots-tag':'noindex, follow'})}});
}
if(p==='/sitemap.xml'){
 const origin=url.origin;let locs=[origin+'/'];
 if(env.DB){try{const [a,d]=await Promise.all([env.DB.prepare("SELECT id FROM as_cars WHERE status='active' ORDER BY created_at DESC LIMIT 2000").all(),env.DB.prepare('SELECT slug FROM as_dealer_profiles WHERE slug IS NOT NULL LIMIT 500').all()]);locs.push(...(a.results||[]).map(x=>origin+'/vetura/'+encodeURIComponent(x.id)),...(d.results||[]).map(x=>origin+'/autosallon/'+encodeURIComponent(x.slug)));const b=await env.DB.prepare("SELECT DISTINCT lower(brand) AS brand FROM as_cars WHERE status='active'").all();for(const [slug,name] of Object.entries(brandPages)){if((b.results||[]).some(x=>x.brand===name.toLowerCase()))locs.push(origin+'/vetura/marka/'+slug)}}catch(e){console.error('sitemap',e)}}
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+locs.map(x=>'<url><loc>'+x.replace(/&/g,'&amp;')+'</loc></url>').join('')+'</urlset>';
 return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=900'}});
}
if(/^\/(vetura|autosallon)\/[a-z0-9-]+$/.test(p)){
 const res=await env.ASSETS.fetch(new Request(new URL('/',url),req));if(!env.DB||!res.ok)return res;
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
// Buyer follows: stored per account; no private buyer information exposed to dealers.
if(p==='/api/dealer/followers'&&method==='GET'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet.'},403);
 const result=await env.DB.prepare('SELECT COUNT(*) AS count FROM as_dealer_follows WHERE dealer_id=?').bind(u.id).first();
 return out({count:Number(result?.count||0)});
}
if(p==='/api/follows'&&method==='GET'){
 const u=await user(req,env.DB);if(!u)return out({dealerIds:[],cars:[]});
 const r=await env.DB.prepare('SELECT dealer_id FROM as_dealer_follows WHERE user_id=? ORDER BY created_at DESC').bind(u.id).all();
 const ids=(r.results||[]).map(x=>x.dealer_id);
 const followed=await env.DB.prepare("SELECT u.id,u.name,p.slug,p.city,p.logo_url,(SELECT COUNT(*) FROM as_cars c WHERE c.user_id=u.id AND c.status='active') AS active_cars FROM as_dealer_follows f JOIN as_users u ON u.id=f.dealer_id LEFT JOIN as_dealer_profiles p ON p.user_id=u.id WHERE f.user_id=? ORDER BY f.created_at DESC").bind(u.id).all();
 const feed=await env.DB.prepare("SELECT c.id,c.brand,c.model,c.year,c.price,c.city,c.created_at,c.user_id AS dealer_id,u.name AS dealer_name FROM as_cars c JOIN as_dealer_follows f ON f.dealer_id=c.user_id JOIN as_users u ON u.id=c.user_id WHERE f.user_id=? AND c.status='active' ORDER BY c.created_at DESC,c.id DESC LIMIT 60").bind(u.id).all();
 return out({dealerIds:ids,dealers:followed.results||[],cars:feed.results||[]});
}
if(p==='/api/follows'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 const b=await body(req);const dealerId=String(b?.dealerId||'');
 if(!/^[0-9a-f-]{36}$/.test(dealerId))return out({error:'Autosallon i pavlefshëm.'},400);
 if(b.follow===true){
  const r=await env.DB.prepare("INSERT OR IGNORE INTO as_dealer_follows (user_id,dealer_id) SELECT ?,id FROM as_users WHERE id=? AND role='autosallon' AND id<>?").bind(u.id,dealerId,u.id).run();
  const check=await env.DB.prepare('SELECT 1 AS ok FROM as_dealer_follows WHERE user_id=? AND dealer_id=?').bind(u.id,dealerId).first();
  if(!check)return out({error:'Autosalloni nuk u gjet.'},404);
 }else if(b.follow===false){await env.DB.prepare('DELETE FROM as_dealer_follows WHERE user_id=? AND dealer_id=?').bind(u.id,dealerId).run()}
 else return out({error:'Vlera follow duhet të jetë true ose false.'},400);
 return out({ok:true});
}
if(p==='/api/dealer/profile'&&method==='GET'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet.'},403);
 const profile=await env.DB.prepare('SELECT * FROM as_dealer_profiles WHERE user_id=?').bind(u.id).first();return out({profile:profile||{}});
}
// Autosallon branding: upload directly to R2, never trust arbitrary object keys from clients.
const brandingUpload=p.match(/^\/api\/dealer\/media\/(logo|cover)$/);
if(brandingUpload&&method==='POST'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet e kyçura.'},403);
 if(!env.PHOTOS)return out({error:'Cloudflare R2 nuk është lidhur.'},503);
 const kind=brandingUpload[1],type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['image/jpeg','image/png','image/webp'].includes(type))return out({error:'Lejohen vetëm JPG, PNG ose WebP.'},415);
 const data=await req.arrayBuffer();if(data.byteLength<100||data.byteLength>4*1024*1024)return out({error:'Fotografia duhet të jetë 100 B deri 4 MB.'},413);
 const bytes=new Uint8Array(data);
 const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10:type==='image/webp'?bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80:false;
 if(!valid)return out({error:'Përmbajtja nuk përputhet me formatin e fotografisë.'},415);
 const previous=await env.DB.prepare(`SELECT ${kind}_url AS url FROM as_dealer_profiles WHERE user_id=?`).bind(u.id).first();
 const key=`dealers/${u.id}/${kind}/${id()}`;
 await env.PHOTOS.put(key,data,{httpMetadata:{contentType:type}});
 const mediaUrl=`/api/dealer/media/${u.id}/${kind}/${key.split('/').pop()}`;
 try{
  await env.DB.prepare(`INSERT INTO as_dealer_profiles (user_id,${kind}_url) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET ${kind}_url=excluded.${kind}_url`).bind(u.id,mediaUrl).run();
 }catch(e){await env.PHOTOS.delete(key);throw e}
 // Delete only the previous object belonging to this dealer and image type.
 // Never delete external URLs or objects owned by another account.
 const oldPrefix=`/api/dealer/media/${u.id}/${kind}/`;
 if(previous?.url?.startsWith(oldPrefix)){
  const oldId=previous.url.slice(oldPrefix.length);
  if(/^[0-9a-f-]{36}$/.test(oldId)){
   try{await env.PHOTOS.delete(`dealers/${u.id}/${kind}/${oldId}`)}catch(e){console.warn('Old branding cleanup failed',e)}
  }
 }
 return out({ok:true,url:mediaUrl});
}
const brandingGet=p.match(/^\/api\/dealer\/media\/([0-9a-f-]{36})\/(logo|cover)\/([0-9a-f-]{36})$/);
if(brandingGet&&method==='GET'){
 if(!env.PHOTOS)return out({error:'Fotografia nuk është e disponueshme.'},503);
 const [all,dealerId,kind,mediaId]=brandingGet;
 const expected=`/api/dealer/media/${dealerId}/${kind}/${mediaId}`;
 const row=await env.DB.prepare(`SELECT ${kind}_url AS url FROM as_dealer_profiles WHERE user_id=?`).bind(dealerId).first();
 if(row?.url!==expected)return out({error:'Fotografia nuk u gjet.'},404);
 const obj=await env.PHOTOS.get(`dealers/${dealerId}/${kind}/${mediaId}`);if(!obj)return out({error:'Fotografia nuk u gjet.'},404);
 return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}});
}
if(p==='/api/dealer/profile'&&method==='POST'){
 const u=await user(req,env.DB);if(!u||u.role!=='autosallon')return out({error:'Vetëm autosallonet.'},403);const b=await body(req);if(!b)return out({error:'Kërkesë e pavlefshme.'},400);
 const slug=str(b.slug,65).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return out({error:'Linku lejon vetëm shkronja a-z, numra dhe vizë.'},400);
 const previous=await env.DB.prepare('SELECT logo_url,cover_url FROM as_dealer_profiles WHERE user_id=?').bind(u.id).first();const vals=[str(b.address,200),str(b.city,70),str(b.phone,35),str(b.whatsapp,35),str(b.hours,160),str(b.instagram,220),str(b.facebook,220),str(previous?.logo_url||'',300),str(previous?.cover_url||'',300)];
 for(const [index,x] of vals.slice(7).entries()){
  const kind=index===0?'logo':'cover';
  const ownR2=new RegExp('^/api/dealer/media/'+u.id+'/'+kind+'/[0-9a-f-]{36}$','i');
  if(x&&!/^https:\/\/[^\s]+$/i.test(x)&&!ownR2.test(x))return out({error:'Fotot duhet të jenë HTTPS ose fotografi të ngarkuara nga ky autosallon.'},400);
 }
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
 // Parameterized search: matches partial names and cities, including mixed case.
 const q=str(url.searchParams.get('q'),80).trim();
 const city=str(url.searchParams.get('city'),70).trim();
 const sql="SELECT u.id,u.name,COUNT(c.id) AS car_count,p.slug,p.address,p.city,p.phone,p.whatsapp,p.hours,p.instagram,p.facebook,p.logo_url,p.cover_url,COALESCE(p.featured,0) featured FROM as_users u LEFT JOIN as_cars c ON c.user_id=u.id AND c.status='active' LEFT JOIN as_dealer_profiles p ON p.user_id=u.id WHERE u.role='autosallon' AND (?='' OR instr(lower(u.name),lower(?))>0 OR instr(lower(COALESCE(p.city,'')),lower(?))>0) AND (?='' OR lower(COALESCE(p.city,''))=lower(?)) GROUP BY u.id,u.name ORDER BY featured DESC,car_count DESC,u.name ASC LIMIT 200";
 const r=await env.DB.prepare(sql).bind(q,q,q,city,city).all();return out({dealers:r.results||[]});
}
async function attachPhotos(rows){if(!rows.length)return rows;const ids=rows.map(x=>x.id);const marks=ids.map(()=>'?').join(',');const found=await env.DB.prepare(`SELECT car_id,photo_key FROM as_car_photos WHERE car_id IN (${marks}) ORDER BY position ASC,created_at ASC`).bind(...ids).all();const by=new Map();for(const x of found.results||[]){if(!by.has(x.car_id))by.set(x.car_id,[]);by.get(x.car_id).push(x.photo_key)}return rows.map(r=>({...r,photos:by.get(r.id)|| (r.photo_key?[r.photo_key]:[])}))}
if(method==='GET'&&/^\/api\/cars\/[0-9a-f-]{36}$/.test(p)){
 const carId=p.split('/')[3];
 const r=await env.DB.prepare("SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.id=? AND c.status='active'").bind(carId).first();
 if(!r)return out({error:'Vetura nuk u gjet.'},404);
 return out({car:safeCar((await attachPhotos([r]))[0])});
}
if(p==='/api/cars'&&method==='GET'){
 const rawLimit=Number(url.searchParams.get('limit'));const rawOffset=Number(url.searchParams.get('offset'));const limit=Number.isFinite(rawLimit)&&rawLimit>0?Math.min(500,Math.max(1,Math.trunc(rawLimit))):48;const offset=Number.isFinite(rawOffset)&&rawOffset>=0?Math.min(100000,Math.trunc(rawOffset)):0;let sql='SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON c.user_id=u.id WHERE c.status=\'active\'';const args=[];
 const dealer=str(url.searchParams.get('dealer'),36);if(dealer&&/^[0-9a-f-]{36}$/.test(dealer)){sql+=' AND c.user_id=?';args.push(dealer)}for(const k of ['brand','model','city','fuel','gear','category','customs']){const v=str(url.searchParams.get(k),70);if(v){sql+=` AND c.${k}=?`;args.push(v)}}for(const [key,op] of [['minPrice','>='],['maxPrice','<='],['minYear','>='],['maxYear','<='],['minKm','>='],['maxKm','<=']]){const val=url.searchParams.get(key);if(val!==null&&val!==''&&Number.isFinite(Number(val))){sql+=' AND c.'+({minPrice:'price',maxPrice:'price',minYear:'year',maxYear:'year',minKm:'km',maxKm:'km'}[key])+op+'?';args.push(Number(val))}}const sortMap={newest:'c.created_at DESC',price_asc:'c.price ASC, c.created_at DESC',price_desc:'c.price DESC, c.created_at DESC',year_desc:'c.year DESC, c.created_at DESC',year_asc:'c.year ASC, c.created_at DESC',km_asc:'c.km ASC, c.created_at DESC',km_desc:'c.km DESC, c.created_at DESC'};const sort=url.searchParams.get('sort')||'newest';sql+=' ORDER BY '+(dealer?'c.pinned DESC, ':'')+(sortMap[sort]||sortMap.newest)+', c.id DESC LIMIT ? OFFSET ?';args.push(limit+1,offset);
 const result=await env.DB.prepare(sql).bind(...args).all();const rows=result.results||[];const hasMore=rows.length>limit;return out({cars:(await attachPhotos(rows.slice(0,limit))).map(safeCar),hasMore,nextOffset:offset+Math.min(rows.length,limit)});
}
// Showroom owners can pin at most three active cars.
const pinMatch=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/pin$/);
if(pinMatch&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 if(u.role!=='autosallon')return out({error:'Vetëm autosallonet mund të fiksojnë vetura.'},403);
 const b=await body(req);if(!b||typeof b.pinned!=='boolean')return out({error:'Zgjedh pinned true ose false.'},400);
 const car=await env.DB.prepare("SELECT id,status FROM as_cars WHERE id=? AND user_id=?").bind(pinMatch[1],u.id).first();
 if(!car)return out({error:'Vetura nuk u gjet.'},404);
 if(b.pinned&&car.status!=='active')return out({error:'Vetëm veturat aktive mund të fiksohen.'},409);
 if(b.pinned){
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM as_cars WHERE user_id=? AND pinned=1 AND status='active' AND id<>?").bind(u.id,car.id).first();
  if(Number(count?.n||0)>=3)return out({error:'Mund të fiksosh maksimumi 3 vetura.'},409);
 }
 await env.DB.prepare('UPDATE as_cars SET pinned=? WHERE id=? AND user_id=?').bind(b.pinned?1:0,car.id,u.id).run();
 return out({ok:true,pinned:b.pinned});
}
if(p==='/api/cars/mine'&&method==='GET'){const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const r=await env.DB.prepare("SELECT c.*,u.name AS seller FROM as_cars c JOIN as_users u ON u.id=c.user_id WHERE c.user_id=? AND c.status IN ('active','sold') ORDER BY c.created_at DESC").bind(u.id).all();return out({cars:(await attachPhotos(r.results||[])).map(safeCar)})}
if(p==='/api/cars'&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);const b=await body(req);if(!b)return out({error:'Invalid request'},400);
 const brand=str(b.brand,70),model=str(b.model,70),city=str(b.city,70),year=Number(b.year),km=Number(b.km),price=Number(b.price),phone=str(b.phone,35),fuel=str(b.fuel,40),gear=str(b.gear,40),description=str(b.description,2500);
 if(!brand||!model||!city||!phone||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1||!Number.isInteger(km)||km<0||km>3000000||!Number.isFinite(price)||price<=0||price>10000000)return out({error:'Kontrollo të dhënat e veturës.'},400);
 const category=str(b.category,35),customs=str(b.customs,45);
 if(!['','SUV','Sedan','Hatchback','Coupe','Karavan','Pickup','Minivan','Cabrio','Tjetër'].includes(category)||!['','Me doganë të paguar','Pa doganë','Me regjistrim RKS'].includes(customs))return out({error:'Kategori ose status dogane i pavlefshëm.'},400);
 const dup=await env.DB.prepare("SELECT id FROM as_cars WHERE user_id=? AND lower(brand)=lower(?) AND lower(model)=lower(?) AND year=? AND km=? AND price=? AND status='active' LIMIT 1").bind(u.id,brand,model,year,km,price).first();if(dup)return out({error:'Kjo veturë duket se është publikuar tashmë në llogarinë tënde.'},409);
 const cid=id();await env.DB.prepare('INSERT INTO as_cars (id,user_id,brand,model,year,km,price,city,fuel,gear,phone,description,category,customs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid,u.id,brand,model,year,km,price,city,fuel,gear,phone,description,category,customs).run();return out({ok:true,id:cid},201)
}
// Owner-controlled sale status. Never deletes a listing or its photos.
const ownStatus=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/status$/);
if(ownStatus&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 const b=await body(req);if(!b||!['active','sold'].includes(b.status))return out({error:'Status i pavlefshëm.'},400);
 const result=await env.DB.prepare("UPDATE as_cars SET status=? WHERE id=? AND user_id=? AND status IN ('active','sold')").bind(b.status,ownStatus[1],u.id).run();
 return result.meta?.changes?out({ok:true,status:b.status}):out({error:'Shpallja nuk u gjet.'},404);
}
// Owner-only quick edit, with strict price validation and bounded text.
const ownEdit=p.match(/^\/api\/cars\/([0-9a-f-]{36})\/edit$/);
if(ownEdit&&method==='POST'){
 const u=await user(req,env.DB);if(!u)return out({error:'Kyçu së pari.'},401);
 const b=await body(req);if(!b||typeof b!=='object'||Array.isArray(b))return out({error:'Kërkesë e pavlefshme.'},400);
 const fields=[],values=[];
 if(Object.prototype.hasOwnProperty.call(b,'price')){const price=Number(b.price);if(!Number.isFinite(price)||price<=0||price>10000000)return out({error:'Çmimi nuk është valid.'},400);fields.push('price=?');values.push(price)}
 for(const [key,max] of [['description',2500],['phone',35]])if(Object.prototype.hasOwnProperty.call(b,key)){const value=str(b[key],max);if(key==='phone'&&value.length<5)return out({error:'Numri i telefonit nuk është valid.'},400);fields.push(key+'=?');values.push(value)}
 if(!fields.length)return out({error:'Nuk ka ndryshime.'},400);
 const result=await env.DB.prepare('UPDATE as_cars SET '+fields.join(',')+" WHERE id=? AND user_id=? AND status IN ('active','sold')").bind(...values,ownEdit[1],u.id).run();
 return result.meta?.changes?out({ok:true}):out({error:'Shpallja nuk u gjet.'},404);
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
 if(!env.PHOTOS)return out({error:'Photos unavailable'},503);const car=await env.DB.prepare("SELECT id,photo_key FROM as_cars WHERE id=? AND status IN ('active','sold')").bind(photo[1]).first();if(!car)return out({error:'Photo missing'},404);
 const index=Number(photo[2]||0);const pic=await env.DB.prepare('SELECT photo_key FROM as_car_photos WHERE car_id=? ORDER BY position ASC,created_at ASC LIMIT 1 OFFSET ?').bind(photo[1],index).first();const key=pic?.photo_key||(index===0?car.photo_key:null);if(!key)return out({error:'Photo missing'},404);const obj=await env.PHOTOS.get(key);if(!obj)return out({error:'Photo missing'},404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}})
}
return out({error:'Endpoint not found'},404);
}catch(e){console.error('AutoShitje API error:',e);return out({error:'Server error. Kontrollo log-et.'},500)}
}};
