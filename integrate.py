from pathlib import Path
import re,zipfile
root=next(Path('/mnt/data/as_work').glob('autoshitje-autoshitje-origjinal-sakte'))
p=root/'public/index.html';s=p.read_text()
replacements={
'Publikimi demo':'Publikimi i shpalljeve',
'Publiko një shpallje demo ose krijo showroom-in tënd personal.':'Publiko veturën tënde dhe kontakto blerësit drejtpërdrejt.',
'Regjistrim dhe kyçje demonstrative. Mos përdor fjalëkalim real.':'Regjistrohu ose kyçu për të publikuar veturën.',
'Fjalëkalimi (vetëm demonstrim)':'Fjalëkalimi',
'minlength="8" required placeholder="Minimumi 8 karaktere"':'minlength="12" required placeholder="Minimumi 12 karaktere"',
'Krijo llogari demo':'Krijo llogari',
'Për siguri, kjo demo nuk ruan fjalëkalime dhe nuk ofron autentikim real.':'Llogaritë dhe shpalljet ruhen në server.',
'Shto një shpallje provuese. Ruhet vetëm në këtë shfletues.':'Shpallja jote publikohet online pas kyçjes.',
'Autosallon (demo)':'Autosallon',
'Fotografitë e veturës (deri në 20)':'Fotografia kryesore e veturës (JPG, PNG, WebP)',
'accept="image/*" multiple':'accept="image/jpeg,image/png,image/webp"',
'Shto fotografitë nga telefoni':'Shto fotografinë e veturës',
'Preke këtu për të zgjedhur foto nga galeria · JPG, PNG, HEIC nëse mbështetet':'JPG, PNG ose WebP · deri në 4 MB',
'Ky formular është vetëm për testim. Nuk publikon shpallje për vizitorë të tjerë dhe nuk ngarkon fotografi në server.':'Shpallja dhe fotografia ruhen në server dhe shfaqen për të gjithë vizitorët.',
'Publiko shpalljen demo ↗':'Publiko shpalljen ↗',
'PANELI DEMONSTRUES':'PANELI IM',
'Shiko të dhënat e ruajtura lokalisht në këtë pajisje.':'Menaxho shpalljet e publikuara në AutoShitje.',
'Shpalljet e mia demo':'Shpalljet e mia',
'Kërkesat demo':'Kontakti me blerësit',
'Pa pagesa online · Pa llogari reale · Showroom premium · Version demonstrues':'Shpallje reale të veturave · Kontakto shitësit drejtpërdrejt',
' · DEMO · Pamje testuese':' · Platformë për vetura',
'Kjo kërkesë nuk i dërgohet shitësit dhe nuk rezervon veturë reale.':'Për kontakt me shitësin përdor telefonin ose WhatsApp-in te shpallja.',
}
for a,b in replacements.items():s=s.replace(a,b)
# disable nonfunctional modal and showrooms; use authentic listing cards only
s=s.replace('Ky showroom është shembull demonstrues.', 'Ky showroom është shembull demonstrues.')
s=s.replace('<section id="autosallonet" class="view">','<section id="autosallonet" class="view">')
script=r'''<script>
'use strict';
const $=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('de-DE')+' €';
const FALLBACK='/logo.svg';
let cars=[],mine=[],currentUser=null,loginMode=false;
function toast(t){const el=$('#toast');if(el){el.textContent=t;el.style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.style.display='none',4500)}}
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});let d;try{d=await r.json()}catch{throw Error('Serveri nuk u përgjigj si duhet.')};if(!r.ok)throw Error(d.error||'Gabim në server');return d}
function navigate(page){if(page==='shpall'&&!currentUser){toast('Kyçu ose regjistrohu për të shpallur veturën.');page='llogaria'}all('.view').forEach(v=>v.classList.toggle('active',v.id===page));window.scrollTo(0,0);if(page==='ballina')renderHome();if(page==='veturat')renderCars();if(page==='paneli')renderPanel();if(page==='autosallonet')renderDealers()}
all('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
function photo(c){return c.photo_key?'/api/photos/'+encodeURIComponent(c.id):FALLBACK}
function card(c){return `<article class="card"><div class="photo"><img src="${esc(photo(c))}" alt="${esc(c.brand+' '+c.model)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'"><span class="tag right">SHPALLJE</span></div><div class="card-body"><h3>${esc(c.brand)} ${esc(c.model)}</h3><div class="spec">${esc(c.year)} · ${esc(c.fuel||'')} · ${esc(c.gear||'')}<br>${Number(c.km).toLocaleString('de-DE')} km · ${esc(c.city)}</div><div class="price">${money(c.price)}</div><div class="card-foot"><span>📍 ${esc(c.city)}</span><button data-car="${esc(c.id)}">Shiko veturën ↗</button></div></div></article>`}
function bindCards(){all('[data-car]').forEach(b=>b.onclick=()=>openCar(b.dataset.car));all('[data-delete]').forEach(b=>b.onclick=()=>deleteCar(b.dataset.delete))}
function renderHome(){$('#featured').innerHTML=cars.length?cars.slice(0,6).map(card).join(''):'<div class="empty">Ende nuk ka shpallje të publikuara. Bëhu i pari!</div>';$('#home-dealers').innerHTML='<div class="empty">Autosallonet e regjistruara do të shfaqen këtu kur të aktivizohet drejtoria e tyre.</div>';bindCards()}
function renderCars(){const v=id=>$(id)?.value||'';const brand=v('#f-brand').toLowerCase(),city=v('#f-city').toLowerCase(),fuel=v('#f-fuel').toLowerCase(),gear=v('#f-gear').toLowerCase();const max=Number(v('#f-price'))||Infinity;const term=(v('#search-input')||v('#f-search')).toLowerCase();const filtered=cars.filter(c=>(!brand||String(c.brand).toLowerCase()===brand)&&(!city||String(c.city).toLowerCase()===city)&&(!fuel||String(c.fuel).toLowerCase()===fuel)&&(!gear||String(c.gear).toLowerCase()===gear)&&Number(c.price)<=max&&(!term||(c.brand+' '+c.model+' '+c.city).toLowerCase().includes(term)));$('#all-cars').innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">Nuk u gjet asnjë veturë.</div>';$('#result-count').textContent=filtered.length+' shpallje reale';bindCards()}
function renderDealers(){$('#dealer-list').innerHTML='<div class="empty">Drejtoria e autosalloneve nuk është aktivizuar ende. Veturat reale gjenden te Veturat.</div>'}
function contactNumber(value){let d=String(value||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0')&&d.length===9)d='383'+d.slice(1);return d.length>=8&&d.length<=15?d:''}
function openCar(id){const c=cars.find(x=>x.id===id);if(!c)return;const phone=contactNumber(c.phone);$('#car-content').innerHTML=`<div class="detail"><div><img class="detail-image" src="${esc(photo(c))}" alt="${esc(c.brand+' '+c.model)}" onerror="this.onerror=null;this.src='${FALLBACK}'"><div class="subhero" style="margin-top:16px"><h2>Detajet e veturës</h2><div class="specgrid"><div><span>Viti</span>${esc(c.year)}</div><div><span>Kilometrat</span>${Number(c.km).toLocaleString('de-DE')} km</div><div><span>Karburanti</span>${esc(c.fuel||'')}</div><div><span>Ndërruesi</span>${esc(c.gear||'')}</div><div><span>Qyteti</span>${esc(c.city)}</div><div><span>Shitësi</span>${esc(c.seller||'Shitësi')}</div></div><p>${esc(c.description||'Nuk ka përshkrim.')}</p></div></div><div class="detail-panel"><div class="eyebrow">SHPALLJE REALE</div><h1>${esc(c.brand)} ${esc(c.model)}</h1><p class="muted">${esc(c.year)} · ${esc(c.city)}</p><div class="price" style="font-size:35px">${money(c.price)}</div><div class="contact-card"><div class="contact-title">☎ Kontakto shitësin</div>${phone?`<div class="contact-phone">${esc(c.phone)}</div><div class="contact-actions"><a class="btn" href="tel:+${phone}">☎ Thirre tani</a><a class="btn whatsapp" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent('Përshëndetje! Jam i interesuar për '+c.brand+' '+c.model+' në AutoShitje.')}">◉ WhatsApp</a></div>`:'<p>Kontakti nuk është i disponueshëm.</p>'}</div></div></div>`;navigate('vetura')}
async function loadCars(){try{cars=(await api('/api/cars?limit=48')).cars||[];renderHome();renderCars()}catch(e){toast('Shpalljet nuk u ngarkuan: '+e.message)}}
function setLogin(b){loginMode=b;$('#tab-register').classList.toggle('active',!b);$('#tab-login').classList.toggle('active',b);$('#role-field').classList.toggle('hide',b);$('#name-field').classList.toggle('hide',b);$('#account-submit').textContent=b?'Kyçu':'Krijo llogari';$('#a-name').required=!b}
$('#tab-register').onclick=()=>setLogin(false);$('#tab-login').onclick=()=>setLogin(true);
$('#a-role').onchange=()=>{$('#name-label').textContent=$('#a-role').value==='autosallon'?'Emri i autosallonit':'Emri dhe mbiemri'};
function accountUI(){const status=$('#account-status');if(currentUser){$('#account-form').hidden=true;status.innerHTML=`<strong>Je kyçur si ${esc(currentUser.name)}</strong> (${esc(currentUser.email)}) <button type="button" class="btn alt small" id="logout-real">Dil nga llogaria</button> <button type="button" class="btn small" id="panel-real">Shpalljet e mia</button>`;$('#logout-real').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST'});currentUser=null;mine=[];accountUI();navigate('ballina')}catch(e){toast(e.message)}};$('#panel-real').onclick=()=>navigate('paneli')}else{$('#account-form').hidden=false;status.textContent='Regjistrohu ose kyçu për të publikuar veturën.'}}
$('#account-form').onsubmit=async e=>{e.preventDefault();const b={email:$('#a-email').value.trim(),password:$('#a-password').value};if(!loginMode){b.name=$('#a-name').value.trim();b.role=$('#a-role').value}const btn=$('#account-submit');btn.disabled=true;try{const d=await api('/api/auth/'+(loginMode?'login':'register'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});currentUser=d.user;$('#a-password').value='';accountUI();toast('Mirë se erdhe!');navigate('paneli')}catch(err){$('#account-status').textContent=err.message;toast(err.message)}finally{btn.disabled=false}};
$('#car-photos').addEventListener('change',e=>{const file=e.target.files?.[0];$('#photo-count').textContent=file?file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB':'Nuk ke zgjedhur fotografi.';$('#photo-preview').innerHTML='';if(file&&file.type.startsWith('image/')){const img=document.createElement('img');img.style.cssText='max-width:140px;max-height:120px;object-fit:cover;border-radius:9px';img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);$('#photo-preview').append(img)}});
$('#post-form').onsubmit=async e=>{e.preventDefault();if(!currentUser){navigate('llogaria');return}const f=new FormData(e.target);const file=$('#car-photos').files?.[0];if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024)){toast('Fotografia duhet të jetë JPG, PNG ose WebP deri në 4 MB.');return}const fields=['brand','model','year','km','price','city','fuel','gear','phone','description'];const b={};for(const k of fields)b[k]=f.get(k)||'';b.year=Number(b.year);b.km=Number(b.km);b.price=Number(b.price);if(!contactNumber(b.phone)){toast('Kontrollo numrin e telefonit.');return}const btn=e.target.querySelector('[type="submit"]');btn.disabled=true;try{const d=await api('/api/cars',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});let photoError='';if(file){try{await api('/api/cars/'+d.id+'/photo',{method:'POST',headers:{'content-type':file.type},body:file})}catch(err){photoError=err.message}}e.target.reset();$('#photo-preview').innerHTML='';$('#photo-count').textContent='Nuk ke zgjedhur fotografi.';await loadCars();await loadMine();toast(photoError?'Shpallja u publikua, por fotografia dështoi: '+photoError:'Shpallja u publikua me sukses!');navigate('paneli')}catch(err){toast(err.message)}finally{btn.disabled=false}};
async function loadMine(){if(!currentUser){mine=[];return}try{mine=(await api('/api/cars/mine')).cars||[]}catch(e){toast(e.message)}}
async function deleteCar(id){if(!confirm('A dëshiron ta fshish këtë shpallje?'))return;try{await api('/api/cars/'+id,{method:'DELETE'});await Promise.all([loadCars(),loadMine()]);renderPanel();toast('Shpallja u fshi.')}catch(e){toast(e.message)}}
function renderPanel(){if(!currentUser){$('#my-cars').innerHTML='<div class="empty">Kyçu për të parë shpalljet e tua.</div>';$('#my-requests').textContent='';return}$('#my-cars').innerHTML=mine.length?mine.map(c=>card(c).replace('</article>',`<div style="padding:0 15px 15px"><button class="btn alt small" data-delete="${esc(c.id)}">Fshi shpalljen</button></div></article>`)).join(''):'<div class="empty">Ende nuk ke publikuar shpallje.</div>';$('#my-requests').textContent='Blerësit të kontaktojnë direkt përmes telefonit ose WhatsApp-it në shpallje.';bindCards()}
all('select[id^="f-"],input[id^="f-"]').forEach(el=>el.addEventListener('change',renderCars));
all('input[id^="f-"],#search-input').forEach(el=>el.addEventListener('input',renderCars));
$('#reserve-modal')?.remove();
(async()=>{try{currentUser=(await api('/api/auth/me')).user||null}catch{}accountUI();await Promise.all([loadCars(),loadMine()]);renderPanel();renderDealers()})();
</script>'''
s=s[:s.find('<script>')]+script+s[s.rfind('</script>')+len('</script>'):]
# eliminate old sample/showroom text from visible UI
s=s.replace('AUTOSHITJE.COM · PLATFORMË PËR VETURA','AUTOSHITJE · PLATFORMË PËR VETURA')
s=s.replace('Shiko showroom-et, shfleto veturat dhe kopjo linkun për bio.','Shiko autosallonet e regjistruara në platformë.')
s=s.replace('Nuk ke zgjedhur fotografi. Fotografia e parë bëhet kryesore.','Nuk ke zgjedhur fotografi.')
s=s.replace('Shiko të dhënat e ruajtura lokalisht në këtë pajisje.','Shiko shpalljet e tua të publikuara online.')
p.write_text(s)
with zipfile.ZipFile('/mnt/data/AutoShitje-REAL-FINAL.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in root.rglob('*'):
  if f.is_file():z.write(f,f.relative_to(root))
print('created',len(s))
