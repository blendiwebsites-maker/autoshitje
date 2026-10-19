# AutoShitje — Version i konsoliduar për dorëzim

**Burimi:** AutoShitje-ADMIN-LLOGARI-FINAL(1).zip dhe ndryshimet e paketës së ndërmjetme.
**Statusi:** Kod i përgatitur; JO i publikuar. Janë verifikuar sintaksa JavaScript, struktura dhe integriteti ZIP, por NUK është bërë test real me Cloudflare D1/R2 apo test i plotë në browser. Prandaj mos e ngarko në degën production pa kaluar kontrollet e mëposhtme.

## Funksionet e përfshira
- Regjistrim/kyçje, ndryshim fjalëkalimi, panel admin me autorizim në server.
- Shpallje me deri 10 fotografi, zgjedhje e fotos kryesore, optimizim në shfletues, zoom.
- Kategori veturash, status dogane, validim dhe bllokim i shpalljeve identike të të njëjtit përdorues.
- Sugjerime marka/modeli me fushë të lirë për të tjera; filtra për model, çmim, vit dhe kilometra, përveç filtrave ekzistues.
- Veturat e sapoardhura, shpallje të ngjashme, të preferuarat lokalisht dhe sinkronizim me llogarinë kur është i kyçur.
- Autosallone me profile të redaktueshme (të dhëna, logo/kopertinë me lidhje HTTPS), link personal dhe showroom; administratori zgjedh autosallonet e dalluara.
- WhatsApp me mesazh të paraplotësuar, buton telefonate, kërkesë për fshirje të llogarisë dhe panel për shqyrtimin e saj.
- Sitemap dinamik, faqe me tituj dhe përshkrime të bazuara në shpallje dhe autosallone, robots.txt.

## Para publikimit (DUHET)
1. Backup i databazës Cloudflare D1 dhe konfigurimit të prodhimit.
2. Konfirmo që `schema-real.sql` dhe `schema-admin.sql` janë zbatuar. Mos ri-ekzekuto `ALTER TABLE` nëse kolonat ekzistojnë.
3. Nëse mungojnë `category` dhe `customs` në `as_cars`, ekzekuto komandat `ALTER TABLE` nga `schema-features.sql` vetëm një herë.
4. Ekzekuto `schema-final-additions.sql` në D1; nuk fshin të dhëna.
5. Kontrollo që `wrangler.toml` lidh saktë DB dhe PHOTOS me D1/R2 të projektit. Sigurohu që llogaria e administratorit ka `is_admin=1`.
6. Testo në mjedis provë: regjistrim, login, logout, ndryshim fjalëkalimi, publikim me 10 foto, ndryshim foto kryesore, zmadhim në iPhone, fshirje, filtra, profilet dhe linket e autosalloneve, shfaqje e autosalloneve të dalluara, admin dhe kërkesat për fshirje, sitemap.
7. Vetëm pasi testet kalojnë, bëj commit në degën `autoshitje-origjinal-sakte` me miratim të shprehur të pronarit.

## Kufizime
- Rikthimi i fjalëkalimit me email është shtyrë; endpointet përgjigjen si joaktive dhe nuk kërkojnë shërbim email.
- Fotot e logos dhe kopertinës së autosallonit përdorin URL HTTPS; ngarkimi direkt i këtyre dy fotove nuk është implementuar.
- Të preferuarat nga pajisje të ndryshme bashkohen pas kyçjes; fshirjet lokale nga pajisje tjetër mund të mos sinkronizohen menjëherë.
- Kërkesa për fshirje kërkon shqyrtim manual nga administratori; nuk fshin automatikisht të dhënat.
- SEO dhe sitemap nuk garantojnë indeksim/renditje në Google.
- Për lista shumë të mëdha (>500 shpallje/autosallon) duhet paginim në server.
