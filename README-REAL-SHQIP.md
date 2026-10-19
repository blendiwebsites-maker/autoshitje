# AutoShitje REAL — Version provë me D1

**Kjo paketë nuk është gati për lançim publik masiv.** Përmban sistem funksional bazë për email/fjalëkalim, sesione me cookie HttpOnly, shpallje reale, fshirje të shpalljeve personale dhe një fotografi kryesore përmes R2 opsionale. Pamja premium demo ruhet te `/`, ndërsa platforma reale e re gjendet te `/real.html`. Nuk ka ende panel administrimi, verifikim emaili, rikthim fjalëkalimi, rate limiting ose autosallone me panel të veçantë.

## Hapat e domosdoshëm, në rend

1. **Ruaj një kopje të kodit aktual të GitHub.** Mos e aktivizo deployment-in e ri para përgatitjes së databazës.
2. Cloudflare → D1 → `autoshitje-db` → Console. Kopjo dhe ekzekuto **një herë** SQL nga `schema-real.sql`. Krijon tabela të reja `as_users`, `as_sessions`, `as_cars` dhe **nuk fshin** tabelat ekzistuese.
3. Opsionale për fotografi: Cloudflare → R2 → krijo bucket `autoshitje-photos`; hiq komentet nga seksioni `[[r2_buckets]]` te `wrangler.toml`. R2 mund të ketë kërkesa faturimi. Pa R2, shpalljet tekstuale punojnë, por fotografia nuk ngarkohet.
4. Ngarko **përmbajtjen e folderëve** `public` dhe `src`, `wrangler.toml` dhe `schema-real.sql` në repository `blendiwebsites-maker/autoshitje`. Ruaje strukturën e dosjeve. GitHub → Commit.
5. Cloudflare Workers Builds: kontrollo statusin e build-it. Nëse ka gabim, shiko log-un, mos bëj deploy manual të ZIP-it.
6. Testo `/api/health` (mode `accounts-and-listings`), `/real.html`, regjistrimin me email testues, kyçjen, krijimin e një veture dhe listën `/api/cars`. Fshije shpalljen testuese.
7. Kur të jenë gati verifikimi i emailit, rikthimi i fjalëkalimit, CAPTCHA/rate limiting, politika e privatësisë dhe moderimi, mund të planifikohet lançimi publik.

**Kujdes:** Database UUID në `wrangler.toml` është ai i dhënë nga përdoruesi. Nëse ndryshon databaza, përditëso ID-në. Mos i ruaj fjalëkalimet në GitHub. Përdor vetëm password testues derisa të kryhen kontrollet e sigurisë. Për shërbim real, nevojiten edhe auditim i sigurisë dhe mbrojtje ndaj abuzimit.
