# AutoShitje — paketë pune për testim (JO E PUBLIKUAR)

Baza: AutoShitje-ADMIN-LLOGARI-FINAL(1).zip. Skedarët e logos, favicon dhe stili origjinal janë ruajtur.

## Të implementuara në këtë paketë
- Paneli ekzistues admin, kyçja, llogaria dhe ndryshimi i fjalëkalimit (nga baza)
- Kategori veturash dhe status dogane me ruajtje në D1, shfaqje në detaje dhe filtra
- Validim i të dhënave në server dhe kontroll i shpalljeve identike për të njëjtin shitës
- Fotografia kryesore e zgjedhur gjatë publikimit, deri 10 foto
- Optimizim në shfletues i fotove (WebP kur rezultati është më i vogël)
- Zmadhim i fotos me pinch/scroll/double-click
- Seksioni 'Veturat e sapoardhura', autosallonet në ballinë, shpallje të ngjashme
- Link për shpërndarjen e showroom-it të autosallonit (me ID të qëndrueshme)
- Të preferuarat të ruajtura lokalisht në shfletues
- Butona ekzistues WhatsApp me mesazh të paraplotësuar dhe thirrje direkte

## Para çdo deploy
1. Ruaj backup të D1.
2. Në Cloudflare D1 ekzekuto **schema-features.sql** VETËM NJË HERË. ALTER TABLE nuk është idempotent. Mos e ekzekuto nëse kolonat category dhe customs ekzistojnë tashmë.
3. Sigurohu që **schema-admin.sql** nga baza është zbatuar më parë, për admin.
4. Kontrollo branch-in autoshitje-origjinal-sakte dhe lidhjet D1/R2.
5. Testo regjistrimin, hyrjen, ngarkimin e fotove, ndryshimin e fjalëkalimit, admin, filtrat, publikimin dhe foton kryesore në një mjedis provë.

## Kufizime të rëndësishme
- Nuk është bërë deploy ose test live në Cloudflare. Janë kontrolluar sintaksa JS dhe integriteti i ZIP.
- Mungojnë ende disa funksione të konfirmuara: profile të pasura dhe redaktimi i autosalloneve, panel për të zgjedhur autosallonet e dalluara, filtrat e plotë të avancuar, listat e plota marka/modele, SEO dinamik dhe sitemap për çdo shpallje, të preferuarat mes pajisjeve, administrimi i kërkesave për fshirjen e llogarisë. Kjo paketë nuk duhet quajtur release final.
- Rikthimi i fjalëkalimit me email nuk është aktivizuar; forma u fsheh, por API i vjetër ende ekziston në kod dhe nuk dërgon email pa konfigurimin Resend. Nuk kërkohet shërbim email me pagesë për funksionet e tjera.
- Verifikimi i statusit doganor nuk bëhet nga platforma; është deklarim i shitësit.
