# Jose Martinez Wildguns Helper — Instrukcja obsługi

> Rozszerzenie do przeglądarki Chrome/Firefox wspomagające grę WildGuns / Wildungs.

---

## Spis treści

1. [Instalacja](#instalacja)
2. [Zakładka Units — oddziały](#zakładka-units--oddziały)
3. [Zakładka Reports — raporty bitewne](#zakładka-reports--raporty-bitewne)
4. [Zakładka Market — oferty handlowe](#zakładka-market--oferty-handlowe)
5. [Zakładka Settings — ustawienia](#zakładka-settings--ustawienia)
6. [Zakładka Pro — odesłanie oddziałów](#zakładka-pro--odesłanie-oddziałów)
7. [Konfiguracja Supabase](#konfiguracja-supabase)
8. [Najczęstsze problemy](#najczęstsze-problemy)

---

## Instalacja

1. Pobierz lub sklonuj repozytorium na swój komputer.
2. Otwórz Chrome i wejdź na stronę `chrome://extensions`.
3. Włącz **Tryb dewelopera** (przełącznik w prawym górnym rogu).
4. Kliknij **Załaduj rozpakowane** i wskaż folder z rozszerzeniem.
5. Ikona rozszerzenia pojawi się na pasku narzędzi przeglądarki.

> **Firefox:** wejdź na `about:debugging` → *Ten Firefox* → *Załaduj tymczasowy dodatek* i wskaż plik `manifest.json`.

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
4. Wyniki pojawią się w konsoli deweloperskiej przeglądarki (`F12` → zakładka *Console*).

> Konfiguracja ofert jest zapisywana automatycznie przy każdym wysłaniu.

---

## Zakładka Settings — ustawienia

Tutaj podajesz dane do połączenia z bazą danych Supabase i ewentualny klucz licencyjny Pro.

| Pole | Co wpisać |
|---|---|
| **Supabase project URL** | Adres projektu, np. `https://abcdef.supabase.co` |
| **Anon / public key** | Klucz publiczny z panelu Supabase (zakładka API) |
| **License key** | Klucz Pro w formacie `WG-XXXX-XXXX-XXXX` (opcjonalnie) |

Po wpisaniu danych kliknij **Save settings**. Jeśli klucz licencyjny jest ważny, pojawi się dodatkowa zakładka **Pro**.

---

## Zakładka Pro — odesłanie oddziałów

> Zakładka Pro jest widoczna tylko po podaniu ważnego klucza licencyjnego.

Funkcja **Odeślij oddziały** automatycznie odsyła wybrane oddziały wspierające z powrotem do ich właścicieli.

**Jak używać:**

1. Otwórz panel wsparcia oddziałów na stronie Wildungs.
2. Przejdź na zakładkę **Pro** w rozszerzeniu.
3. W polu tekstowym wpisz **ID wiosek** oddziałów do odesłania, oddzielone przecinkami, np.:
   ```
   40285, 38594, 12043
   ```
4. Kliknij **Odeślij oddziały**.
5. Stan operacji pojawi się pod przyciskiem (zielony = sukces, czerwony = błąd).

---

## Konfiguracja Supabase

Supabase to darmowa baza danych w chmurze. Aby korzystać z funkcji zapisu:

1. Załóż konto na [supabase.com](https://supabase.com) i utwórz nowy projekt.
2. W panelu projektu wejdź w **Settings → API**.
3. Skopiuj **Project URL** oraz **anon public** key.
4. Wklej oba w zakładce **Settings** rozszerzenia i kliknij **Save settings**.
5. W edytorze SQL Supabase utwórz wymagane tabele (skrypt SQL dostępny w repozytorium).

> Klucz `anon` jest bezpieczny — polityka RLS na tabelach zezwala wyłącznie na wstawianie danych (`INSERT`), nie na ich odczyt.

---

## Najczęstsze problemy

| Objaw | Rozwiązanie |
|---|---|
| Przycisk **Read** nie działa / brak odpowiedzi | Upewnij się, że otwarta jest właściwa strona gry (panel oddziałów lub raport bitewny). Odśwież stronę i spróbuj ponownie. |
| **Send to Supabase** zwraca błąd | Sprawdź w zakładce Settings, czy URL i klucz Supabase są poprawne. |
| **Send Market Offers** jest nieaktywny (szary) | Aktywna karta przeglądarki musi być stroną gry (wildungs.com lub wildguns.gameforge.com). |
| `userToken not found` w konsoli | Musisz być zalogowany do gry — token jest dostępny tylko na zalogowanej stronie. |
| Zakładka **Pro** nie pojawia się | Sprawdź klucz licencyjny w Settings i upewnij się, że Supabase URL jest poprawny. |
