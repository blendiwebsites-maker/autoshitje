# AutoShitje – showroom premium

Ky build përmban dizajnin e ri të showroom-it publik: kopertinë, logo, profil, butonat Follow/Share, telefon/WhatsApp/navigim, link personal, filtrin e markës/modelit, renditjen e veturave dhe shfaqjen e veturave të fiksuara së pari. Bazohet në paketën MOBILE-FIX dhe ruan pjesën tjetër të kodit.

Kontrolluar: node --check i serverit dhe 6 skriptet inline të faqes. NUK është testuar në Cloudflare D1/R2 ose në Safari iPhone. NUK garantohet që të 40 kërkesat e mëhershme janë plotësuar.

KUJDES: GitHub është i lidhur me deploy automatik në Cloudflare. Bëni backup dhe kontrolloni konfigurimin/migrimet e D1 para se të vendosni skedarët në degën e deploy-it. Mos ngarkoni ZIP-in si skedar të vetëm në repository; duhet nxjerrë përmbajtja në root.
