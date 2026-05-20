# Jose Martinez Wildguns Helper — Instrukcja obsługi

> Rozszerzenie do przeglądarek Chromium (Chrome, Edge, Opera, Safari) /Firefox wspomagające grę WildGuns.

---

## Spis treści

1. [Bezpieczeństwo — co NIGDY nie wklejaj](#bezpieczeństwo--co-nigdy-nie-wklejaj)
2. [Instalacja](#instalacja)
3. [Zakładka Units — oddziały](#zakładka-units--oddziały)
4. [Zakładka Reports — raporty bitewne](#zakładka-reports--raporty-bitewne)
5. [Zakładka Market — oferty handlowe](#zakładka-market--oferty-handlowe)
6. [Zakładka Settings — ustawienia](#zakładka-settings--ustawienia)
7. [Konfiguracja Supabase](#konfiguracja-supabase)
8. [Najczęstsze problemy](#najczęstsze-problemy)

---

## Bezpieczeństwo — co NIGDY nie wklejaj

> ⚠️ **Ważne, przeczytaj zanim zaczniesz korzystać z rozszerzenia.**

Podczas grania w WildGuns Twoja przeglądarka przechowuje **token sesji**
(`userToken`), **ciasteczka logowania** i czasem pełne polecenia `curl` z
poziomu narzędzi deweloperskich. **Każda z tych rzeczy daje pełen dostęp do
Twojego konta** — kto je zdobędzie, ten może wysyłać surowce, atakować, czytać
raporty, zmieniać ustawienia konta.

**Nigdy nie wklejaj tych wartości:**

- w czatach (Discord, WhatsApp, kanały gildii itp.),
- na zrzutach ekranu publikowanych w internecie,
- w narzędziach trzecich (skryptach, generatorach, „pomocnikach” z forów),
- w polach tego rozszerzenia, które o nie nie proszą.

Rozszerzenie odczytuje `userToken` samodzielnie z zalogowanej strony gry —
**nigdy nie musisz wprowadzać go ręcznie**. Jedyne dane, jakie wpisujesz, to
adres URL projektu Supabase i klucz publiczny (`anon key`) — oba są
przewidziane do udostępniania klientowi i nie dają dostępu do Twojego konta
w grze.

Jeśli podejrzewasz, że Twój token wyciekł: **wyloguj się z gry i zaloguj
ponownie** — to unieważni stary token.

---

## Instalacja

1. Pobierz zip z rozszerzeniem z głównej strony repozytorium (Releases).
2. Otwórz Chrome i wejdź na stronę `chrome://extensions`.
3. Włącz **Tryb dewelopera** (przełącznik w prawym górnym rogu).
4. Kliknij **Załaduj rozpakowane** i wskaż folder z rozszerzeniem.
5. Ikona rozszerzenia pojawi się na pasku narzędzi przeglądarki.

> **Firefox:** wejdź na `about:debugging` → _Ten Firefox_ → _Załaduj tymczasowy dodatek_ i wskaż plik `manifest.json`.

---

## Zakładka Units — oddziały

Służy do odczytania stanu oddziałów wspierających z panelu jednostek na stronie Wildungs.

**Jak używać:**

1. Zaloguj się do gry i otwórz panel **Wsparcie oddziałów** (lista jednostek z innych wiosek).
2. Kliknij ikonę rozszerzenia, aby otworzyć popup.
3. Upewnij się, że jesteś na zakładce **Units**.
4. Kliknij **Read units from page** — rozszerzenie odczyta dane z aktywnej karty.
5. W okienku pojawi się podgląd oddziałów każdego gracza.
6. Możesz teraz:
   - **Download JSON** — zapisać dane jako plik `.json` na dysku,
   - **Send to Supabase** — wysłać dane bezpośrednio do bazy (wymaga skonfigurowania Supabase).

---

## Zakładka Reports — raporty bitewne

Służy do odczytania i zapisania raportu z bitwy w WildGuns.

**Jak używać:**

1. Otwórz dowolny raport bitewny na stronie `wildguns.gameforge.com`.
2. Kliknij ikonę rozszerzenia i przejdź na zakładkę **Reports**.
3. Kliknij **Read battle report** — rozszerzenie odczyta atakującego, obrońcę, jednostki, łupy, datę i szczęście.
4. Pojawi się podgląd z podziałem na stronę atakującą (czerwona) i obronną (zielona).
5. Kliknij **Download JSON** lub **Send to Supabase**.

> Jednostki grupowe (gwiazdkowe) są oznaczone złotą odznaką z poziomem, np. ★2.

---

## Zakładka Market — oferty handlowe

Pozwala automatycznie wystawiać oferty handlowe na rynku gry.

**Jak skonfigurować oferty:**

- Każdy wiersz to jedna oferta. Kolumny oznaczają:
  - **Offering** — surowiec, który oferujesz (np. `wood`)
  - **Amount** — ilość oferowanego surowca
  - **→** (strzałka) — oddziela ofertę od żądania
  - **Wanting** — surowiec, który chcesz dostać (np. `food`)
  - **Amount** — ilość żądanego surowca
  - **×** — liczba kopii tej oferty do wystawienia jednocześnie
- Kliknij **+ Add offer**, aby dodać nowy wiersz.
- Kliknij **×** po prawej stronie wiersza, aby go usunąć.
- Pole **Runtime (h)** określa, na ile godzin wystawiane są oferty (domyślnie 12).

**Jak wysłać oferty:**

1. Zaloguj się do gry i pozostań na stronie gry (Wildungs lub WildGuns).
2. Skonfiguruj oferty w zakładce Market.
3. Kliknij **Send Market Offers** — przycisk jest aktywny tylko wtedy, gdy aktywna karta przeglądarki to strona gry.
4. Wyniki pojawią się w konsoli deweloperskiej przeglądarki (`F12` → zakładka _Console_).

> Konfiguracja ofert jest zapisywana automatycznie przy każdym wysłaniu.

---

## Zakładka Settings — ustawienia

Tutaj podajesz dane do połączenia z bazą danych Supabase.

| Pole                     | Co wpisać                                              |
| ------------------------ | ------------------------------------------------------ |
| **Supabase project URL** | Adres projektu, np. `https://abcdef.supabase.co`       |
| **Anon / public key**    | Klucz publiczny z panelu Supabase (zakładka API)       |

Po wpisaniu danych kliknij **Save settings**.

---

## Najczęstsze problemy

| Objaw                                          | Rozwiązanie                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Przycisk **Read** nie działa / brak odpowiedzi | Upewnij się, że otwarta jest właściwa strona gry (panel oddziałów lub raport bitewny). Odśwież stronę i spróbuj ponownie. |
| **Send to Supabase** zwraca błąd               | Sprawdź w zakładce Settings, czy URL i klucz Supabase są poprawne.                                                        |
| **Send Market Offers** jest nieaktywny (szary) | Aktywna karta przeglądarki musi być stroną gry (wildungs.com lub wildguns.gameforge.com).                                 |
| `userToken not found` w konsoli                | Musisz być zalogowany do gry — token jest dostępny tylko na zalogowanej stronie.                                          |
