# ♞ Chess Arena — Grandmaster Edition

**Rozbudowana aplikacja szachowa w języku polskim, działająca w przeglądarce, ze Stockfish 19 Lite (WebAssembly) jako przeciwnikiem.** Nowoczesny, responsywny interfejs, analiza pozycji i lokalna historia rozgrywek. Bez kont użytkowników, bez serwera i bez zewnętrznego API do wykonywania ruchów.

## Co potrafi aplikacja?

| Obszar | Funkcjonalności |
| --- | --- |
| Rozgrywka | Gra z silnikiem Stockfish 19 Lite, 6 poziomów trudności, wybór koloru, losowy kolor, przeciąganie figur i sterowanie kliknięciami |
| Szachy | Weryfikacja legalności ruchów, szach i mat, roszada, bicie w przelocie, promocja pionka, pat, trzykrotne powtórzenie pozycji, remisy |
| Zegar | 3+2, 5+3, 10+0 oraz bez limitu czasu; naliczanie inkrementu, przegrana na czas |
| Analiza | Osobny Web Worker silnika, ocena w pionach z perspektywy białych, wskazanie wariantu, głębokość analizy, podpowiedzi |
| Historia | Lista ruchów SAN, odtwarzanie partii, rozpoznawanie wybranych debiutów, cofanie ostatniej tury |
| Import/eksport | Import FEN i PGN, kopiowanie FEN do schowka, eksport partii jako PGN |
| Personalizacja | Jasny/ciemny motyw, trzy szachownice, obrót planszy, współrzędne, dźwięki, legalne ruchy |
| Trwałość danych | Automatyczny zapis bieżącej rozgrywki, archiwum 40 ostatnich partii, statystyki zwycięstw/remisów |
| Dostępność | Klawiatura: strzałki do przeglądania ruchów, klawisz F do obrotu, opis pól dla czytników ekranu |

## Technologie

- **React 19 + TypeScript 5.9** — interfejs i logika stanu.
- **Vite 8** — serwer programistyczny i kompilacja.
- **chess.js 1.4** — pełna legalność ruchów oraz FEN/PGN.
- **Stockfish 19 Lite Single-Threaded (WASM)** — mocny silnik UCI uruchamiany lokalnie w przeglądarce. Osobne procesy Web Worker obsługują przeciwnika i analizę.
- **Lucide React** — ikony, bez zależności od usług backendowych.
- **localStorage** — zapisy partii i ustawień.

> Wersja *Lite* korzysta z mniejszej sieci neuronowej niż pełny Stockfish. Nadal stanowi bardzo wymagającego przeciwnika, ale nie jest identyczna z pełną wersją silnika. Wyświetlane Elo jest orientacyjnym ustawieniem silnika UCI, a nie oficjalnym rankingiem FIDE.

## Uruchomienie w Windows / VS Code

Wymagany **Node.js 22.12 lub nowszy** i połączenie z Internetem podczas pierwszej instalacji pakietów.

```bash
npm install
npm run dev
```

Otwórz **http://localhost:5173**. Skrypt `postinstall` kopiuje `stockfish-19-lite-single.js` i `stockfish-19-lite-single.wasm` z pakietu npm `stockfish` do `public/engine/`. Bez tych plików przeciwnik nie będzie działał. Nie uruchamiaj aplikacji przez bezpośrednie otwarcie `index.html` jako `file://` — wymagany jest serwer HTTP z obsługą WebAssembly.

Pozostałe komendy:

```bash
npm run build       # produkcyjny build w katalogu dist/
npm run preview     # podgląd produkcyjny
npm run typecheck   # sprawdzanie typów
npm run test        # testy funkcji pomocniczych
```

## Publikacja na GitHub Pages

1. Utwórz **puste repozytorium** GitHub o nazwie np. `chess-arena` (bez generowania osobnego README, licencji i `.gitignore`).
2. W rozpakowanym folderze projektu:

```bash
git init
git branch -M main
git add .
git commit -m "feat: chess arena with Stockfish 19"
git remote add origin https://github.com/Derox266/chess-arena.git
git push -u origin main
```

3. W ustawieniach repozytorium wybierz **Settings → Pages → Build and deployment → GitHub Actions**.
4. Workflow `.github/workflows/deploy.yml` sam zainstaluje zależności, zbuduje aplikację i opublikuje ją na GitHub Pages po pushu do `main`.

Wersja Vite jest skonfigurowana z `base: './'`, aby statyczne pliki działały również pod adresem repozytorium `https://derox266.github.io/chess-arena/`.

## Struktura projektu

```text
chess-arena/
├─ .github/workflows/deploy.yml # automatyczne wdrożenie
├─ public/engine/               # pliki silnika kopiowane przez npm install
├─ scripts/copy-engine.mjs      # przygotowanie przeglądarkowego Stockfish
├─ src/
│  ├─ components/ChessBoard.tsx # interaktywna szachownica
│  ├─ components/ClockCard.tsx  # zegary i profile graczy
│  ├─ components/Dialog.tsx     # okna dialogowe
│  ├─ lib/chess-utils.ts        # notacja, debiuty, wyniki i analiza
│  ├─ lib/engine.ts             # dwa niezależne silniki Web Worker
│  ├─ lib/chess-utils.test.ts   # testy jednostkowe
│  ├─ App.tsx                   # zarządzanie partią i widokami
│  ├─ styles.css                # interfejs RWD
│  └─ types.ts                  # wspólne typy i ustawienia
├─ package.json
└─ vite.config.ts
```

## Znane ograniczenia i dalszy rozwój

- To jest aplikacja **single-player**. Nie zawiera gry sieciowej, logowania ani kont przechowywanych na serwerze.
- Zapis jest lokalny dla konkretnej przeglądarki. Przy czyszczeniu localStorage można utracić dane; eksport PGN jest zalecany.
- Analiza to ocena i pierwszy wariant z silnika na wybranej głębokości, a nie pełny serwis analityczny z tabelami końcówek, MultiPV i przeglądem błędów każdej partii.
- Czas liczony jest w aktywnej karcie; przy uśpieniu systemu/przeglądarki zegar może nie odzwierciedlać dokładnie czasu rzeczywistego. Gra nie jest przeznaczona do turniejów z oficjalnymi zegarami.
- Testy jednostkowe obejmują krytyczne funkcje pomocnicze; przed publicznym wdrożeniem zalecane są testy end-to-end w Chrome i Firefox.

## Licencja

Kod projektu udostępniany na **GPL-3.0** (plik `LICENSE`). Stockfish jest dystrybuowany na licencji GPL-3.0; źródła i informacje o licencji: [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) oraz [Stockfish](https://github.com/official-stockfish/Stockfish). Biblioteka chess.js jest dystrybuowana na BSD-2-Clause. Kod Stockfish pozostaje własnością jego autorów.
