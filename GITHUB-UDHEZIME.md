# AutoShitje – GitHub package (not production-certified)

Kjo paketë mund të ngarkohet në GitHub. **Mos e aktivizo deploy automatik** derisa të përfundohen testet dhe migrimet D1.

## Kujdes: databaza ekzistuese
- Ruaj backup të D1 para ndryshimeve.
- Skedarët `schema-*.sql` përfshijnë ndryshime që duhen kontrolluar dhe aplikuar sipas gjendjes së databazës; **mos ekzekuto `schema-real.sql` si reset**.
- `schema-pinned.sql` përmban `ALTER TABLE ... ADD COLUMN pinned` dhe aplikohet vetëm një herë në databazën ku mungon kolona.
- Kontrollo gjithashtu `schema-follows.sql`, `schema-features.sql`, `schema-final-additions.sql`.
- `wrangler.toml` ka ID të databazës dhe emrin e bucket-it; verifiko që përputhen me Cloudflare para deploy.

## Çfarë u kontrollua lokalisht
- Sintaksa JavaScript e serverit dhe skripteve inline të faqes.
- Integriteti i ZIP.

## Çfarë nuk është certifikuar
- Të 40 kërkesat në browser real, D1/R2 live, autorizimi dhe migrimet.
- Nuk është bërë deploy në faqen ekzistuese.
