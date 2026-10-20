# AutoShitje — kontroll i zhvillimit

- Bazë: WORK-IN-PROGRESS-13.
- U shtua ruajtja dhe rikthimi i fushave të kërkimit në sessionStorage gjatë navigimit.
- Sintaksa e skripteve në HTML dhe e serverit: kontrolluar me node --check.
- Nuk është testuar në shfletues real ose me Cloudflare D1/R2.
- Kjo NUK është paketë finale dhe nuk duhet publikuar.
- Kërkesat e tjera të listës prej 40 pikash mbeten për auditim dhe realizim.

- U shtua lista e 38 komunave te Kosoves ne fushat ekzistuese city, pa hequr vlerat ekzistuese.
- U verifikua sintaksa e te gjitha skripteve dhe e serverit.
- Nuk eshte testuar ne browser/D1 dhe nuk eshte bere deploy.

- U shtua paneli i lajmerimeve te veturave nga autosallonet e ndjekura, me link per shpalljen. Sintaksa u verifikua; pa teste D1/browser.

## 2026-10-20 R2 branding backend
- POST /api/dealer/media/logo and /cover: authenticated autosallon, JPG/PNG/WebP, 4MB limit, magic-byte validation, R2 upload and D1 URL update.
- GET /api/dealer/media/:dealerId/:kind/:mediaId: serves only current referenced object.
- Still needed: frontend file upload UI and live D1/R2 integration tests. No deployment.

2026-10-20: Korrigjuar validimi i logo_url/cover_url ne POST /api/dealer/profile: pranohen edhe URL relative R2 te pronarit. Kontroll sintakse Node.js kaloi; D1/R2 live ende pa testuar.
