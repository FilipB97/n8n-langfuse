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
npm run package
```

## Typowy cykl pracy

1. Dodaj lub zmien test dla helpera albo logiki operacji.
2. Uruchom `npm test`.
3. Dopisz implementacje.
4. Uruchom `npm run compile`.
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

## Pakowanie

```bash
npm run compile
npm pack --dry-run
```

## Instalacja w n8n lokalnie

1. Zbuduj pakiet.
2. Zainstaluj go w Twojej instancji n8n jako community node albo jako lokalny custom node.
3. Dodaj credential `Langfuse API`.
4. Uzyj node `Langfuse` w workflow.

## Uwaga o przyszlym rozwoju

Jesli bedziesz chcial rozszerzyc node o OTel, najlepiej dodac osobny resource/operation zestaw zamiast rozbudowywac ingestion do granic czytelnosci.
