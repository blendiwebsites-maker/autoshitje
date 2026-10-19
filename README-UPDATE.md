# AutoShitje – 10 fotografi dhe autosallone reale

Ky ZIP ruan pamjen dhe logon origjinale. Ndryshimet:
- Deri në 10 fotografi JPG/PNG/WebP për veturë (maksimumi 4 MB secila), me galeri në detaje.
- Autosallonet merren nga llogaritë reale me rol `autosallon` dhe shfaqin numrin e shpalljeve aktive.
- Shfaqja e veturave të autosallonit në showroom.

## HAP I DETYRUESHËM para deploy

Cloudflare → D1 → `autoshitje-db` → Console: ekzekuto vetëm këto dy komanda SQL (të sigurta për përsëritje):

```sql
CREATE TABLE IF NOT EXISTS as_car_photos (id TEXT PRIMARY KEY,car_id TEXT NOT NULL REFERENCES as_cars(id) ON DELETE CASCADE,photo_key TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS as_car_photos_car ON as_car_photos(car_id,position);
```

Pastaj zëvendëso skedarët e branch-it `autoshitje-origjinal-sakte` me këta të ZIP-it dhe bëj deploy të atij branch-i në Cloudflare. MOS përdor `main` dhe mos e zëvendëso databazën. Përditësimi nuk është testuar në databazën tënde reale; kontrollo regjistrimin, një shpallje testuese dhe ngarkimin e 2 fotografive pas publikimit.

Kufizim teknik: lista publike e veturave aktualisht merr deri në 48 shpalljet më të reja; showroom-i duhet të ketë listim të veçantë për autosallone me më shumë shpallje.
