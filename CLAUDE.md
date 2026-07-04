# Memorae

AI-powered digital memory assistant. Phase 1: a Telegram chatbot where users manage
their calendar, reminders and notes in natural language; an LLM orchestrator
(Claude, via forced tool-calling) interprets each message into actionable intents.

## Tech stack

- **Language:** TypeScript (strict) on Node.js ≥ 22, ESM (`NodeNext` — relative imports use `.js` extensions)
- **Package manager:** pnpm
- **LLM:** Anthropic SDK (`@anthropic-ai/sdk`), model `claude-opus-4-8` by default, structured output via forced tool use
- **Integrations:** Telegram Bot API (long polling, native `fetch`), Google Calendar REST v3, Microsoft Graph (To Do + OneNote) as the Samsung Reminder/Notes bridge
- **Persistence:** Repository Pattern with in-memory implementations (Postgres/Mongo adapters slot in later)
- **Tests:** Vitest · **Lint:** ESLint (typescript-eslint flat config)

## Commands

```sh
pnpm install          # install dependencies
pnpm dev              # run the bot with hot reload (tsx watch)
pnpm build            # compile to dist/ (tsconfig.build.json)
pnpm start            # run the compiled bot
pnpm test             # unit tests (vitest run)
pnpm typecheck        # tsc --noEmit over src + tests
pnpm lint             # eslint
```

Configuration comes from environment variables — copy `.env.example` and fill in
`TELEGRAM_BOT_TOKEN` and `ANTHROPIC_API_KEY` (the minimum to run; Google/MS Graph
fall back to mock adapters when their credentials are absent).

## Architecture

Hexagonal / Clean Architecture. Dependencies always point inward:

```
src/
├── domain/           # Entities, value objects, ports. ZERO outward imports, zero npm deps.
│   ├── entities/     #   User, CalendarEvent, Reminder, Note, MemoryIntent (discriminated union)
│   ├── value-objects/#   IncomingMessage (channel-agnostic inbound message)
│   └── ports/        #   Repository interfaces + driven ports:
│                     #   IntentExtractorPort, CalendarProviderPort,
│                     #   UnifiedReminderServicePort, MessagingGatewayPort, Clock, IdGenerator
├── use-cases/        # Orchestration only; imports domain only.
│                     #   ExtractIntent, CreateCalendarEvent, CreateReminder, CreateNote,
│                     #   HandleIncomingMessage (resolve user → extract → dispatch → reply)
├── infrastructure/   # Adapters; each implements exactly one port.
│   ├── ai/           #   AnthropicIntentExtractor + tool schema + defensive payload parser
│   ├── telegram/     #   TelegramBotAdapter (driving: long polling; driven: MessagingGatewayPort)
│   ├── google/       #   GoogleCalendarAdapter (skeleton) + MockCalendarProvider
│   ├── samsung-bridge/#  MsGraphReminderBridge (skeleton) + InMemoryReminderService (mock)
│   ├── persistence/  #   in-memory/ repositories (swap here for Postgres/Mongo)
│   ├── system/       #   SystemClock, UuidIdGenerator
│   └── config/       #   env.ts — typed AppConfig from process.env
└── main.ts           # Composition root — the ONLY place concrete classes meet interfaces.
tests/                # Vitest unit tests + fakes (no network, everything through ports)
```

### Design rules (enforce these in every change)

1. **Dependency rule:** `domain` imports nothing from `use-cases`/`infrastructure`;
   `use-cases` imports only `domain`; only `main.ts` imports across all layers.
2. **Ports before adapters:** any new external system gets an interface in
   `domain/ports/` first, then an implementation in `infrastructure/`.
3. **No framework types in domain/use-cases** — no SDK types, no `fetch`, no env vars.
4. **Entities validate their own invariants** in static `create()` factories and are
   immutable (mutations return new instances, e.g. `withExternalId`).
5. **LLM output is untrusted input:** everything from the model goes through
   `parseIntentExtraction`, which degrades malformed payloads to `unknown` intents
   instead of throwing.
6. **One utterance → many intents:** `IntentExtraction.intents` is an array; never
   assume a single intent per message.
7. **Mock-first integrations:** every driven port has a mock/in-memory implementation
   so the bot always runs end-to-end; `main.ts` picks real vs. mock from config.
8. **Tests exercise ports with fakes** (`tests/helpers/fakes.ts`); no network in unit tests.

### Samsung Reminder/Notes bridge

Samsung has no public REST API, so the domain exposes `UnifiedReminderServicePort`
(capability, not vendor). `MsGraphReminderBridge` maps it to Microsoft Graph —
Samsung Reminder syncs with Microsoft To Do and Samsung Notes with OneNote, so items
created through Graph land on the user's Samsung devices. `InMemoryReminderService`
is the credential-free stand-in.

### Known skeleton gaps (next steps)

- Google/MS Graph auth uses a static access token (`staticTokenProvider`); replace
  with a real OAuth2 refresh flow (google-auth-library / MSAL).
- Persistence is in-memory; add a Postgres adapter implementing the same repository
  interfaces.
- Telegram uses long polling; a webhook adapter can replace it without touching
  use-cases (same `IncomingMessage` + `MessagingGatewayPort`).
