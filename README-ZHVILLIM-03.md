# AutoShitje — faza 03 (jo version final)

Shtuar në backend:
- POST /api/cars/:id/status me JSON {"status":"sold"} ose {"status":"active"}. Vetëm pronari i shpalljes mund ta ndryshojë.
- POST /api/cars/:id/edit për ndryshim të shpejtë të price, phone dhe description. Vetëm pronari.

Kërkohet integrimi i ndërfaqes dhe testim i plotë me Cloudflare D1/R2. Nuk ka ndryshime në databazë për këto dy endpoint-e. Mos bëni deploy pa miratim.
