# Rozwoj lokalny

## Wymagania

- Node.js 18+ albo 20+
- n8n lokalnie lub w kontenerze
- dostep do Langfuse public key i secret key

## Struktura

- `credentials/` - credential definition dla Langfuse
- `nodes/` - node n8n
- `src/` - helpery, typy i logika budowania payloadow
- `tests/` - testy node runner i helperow
- `docs/` - dokumentacja

## Komendy

```bash
npm run compile
npm test
npm run lint      # tsc --noEmit + eslint (konwencje n8n)
npm run lint:fix  # auto-naprawa reguł eslint
npm run package
```

## Lint

`npm run lint` uruchamia type-check (`tsc --noEmit`) oraz `eslint-plugin-n8n-nodes-base`,
który pilnuje konwencji node'ów n8n (styl opisów, pisownia `ID`, kolejność opcji,
opisy pól boolean zaczynające się od "Whether"). Ten sam lint działa w CI na każdym PR.

## Typowy cykl pracy

1. Dodaj lub zmien test dla helpera albo logiki operacji.
2. Uruchom `npm test`.
3. Dopisz implementacje.
4. Uruchom `npm run lint` i `npm run compile`.
5. Sprawdz `git diff`.

## Lokalny build

`npm run compile` generuje `dist/` z:

- `dist/index.js`
- `dist/nodes/Langfuse/Langfuse.node.js`
- `dist/credentials/LangfuseApi.credentials.js`

## Lokalny test

```bash
npm test
```

Testy obejmuja:

- normalizacje base URL
- Basic Auth header
- budowanie eventow ingestion
- parse JSON helpery
- zachowanie 207 multi-status
- mapowanie opcji node do payloadow
- rozwiazywanie endpointow Public API (w tym Dataset API)
- warstwe wykonania node (`runExecute`): routing operacji, budowa body POST, `pairedItem`, `continueOnFail`

## Pakowanie

```bash
npm run compile
npm pack --dry-run
```

## Wydania (release)

Wydania sa sterowane tagiem. Aby wydac wersje `X.Y.Z`:

1. Podbij `version` w `package.json`.
2. W `CHANGELOG.md` przenies sekcje `## [Unreleased]` do `## [X.Y.Z] - <data>` i dodaj
   link wersji na dole pliku.
3. Zacommituj, wypchnij i zmerguj do `main`.
4. Utworz i wypchnij tag: `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`.

Tag uruchamia workflow `publish.yml`, ktory:

- publikuje paczke na npm **idempotentnie** — jesli `name@version` juz istnieje na npm,
  krok publikacji jest pomijany (tag nie powoduje wiec podwojnej publikacji),
- tworzy **GitHub Release** dla tagu, z notatkami wyciaganymi z `CHANGELOG.md`
  (`scripts/changelog-section.mjs`); jesli release dla tagu juz istnieje, krok jest pomijany.

`workflow_dispatch` (reczne uruchomienie) publikuje idempotentnie, ale nie tworzy
GitHub Release — release powstaje tylko przy pushu tagu.

## Instalacja w n8n lokalnie

1. Zbuduj pakiet.
2. Zainstaluj go w Twojej instancji n8n jako community node albo jako lokalny custom node.
3. Dodaj credential `Langfuse API`.
4. Uzyj node `Langfuse` w workflow.

## Uwaga o przyszlym rozwoju

Jesli bedziesz chcial rozszerzyc node o OTel, najlepiej dodac osobny resource/operation zestaw zamiast rozbudowywac ingestion do granic czytelnosci.
