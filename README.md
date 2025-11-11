# Aurora Research OS

Aurora Research OS is an AI-assisted "Research-in-a-Box" platform that helps clinicians turn real-world ideas into a coherent, standards-aligned **baseline draft package** (protocol, SAP, CRFs, PIS/ICF, ethics & CTRI mapping) plus a live eCRF workspace — without claiming regulatory approval. 

Version 1 is focused on India and aligns with ICMR ethics guidelines, CTRI dataset structure, Indian GCP/NDCT principles, and ICH E6(R3) expectations, using strict guardrails and full auditability.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- (Optional) Gemini API key for AI-enhanced document generation

### Installation

```bash
# Install dependencies
npm install

# Build core package
npm run build --workspace @aurora/core

# Fix TypeScript exports (required after build)
cd packages/core && node fix-exports.js
```

### Development

```bash
# Start web app (dev server)
npm run dev:web

# Start API server (in another terminal)
npm run dev:api
```

The web app will be available at `http://localhost:3000` and the API at `http://localhost:3001`.

### AI Enhancement (Optional)

To enable AI-powered document generation:

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a `.env` file in the root directory:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```
3. Restart the API server

Without an API key, the system will use template-based generation (fully functional, just less customized).

## Project Structure

```
├── apps/
│   └── web/              # Next.js frontend (App Router)
├── services/
│   └── api/              # Express backend API
└── packages/
    └── core/             # Shared logic, rulebook, orchestration
```

## Key Features

- **Natural Language Input**: Describe your study idea in plain English
- **Design Selection**: Automatic study design recommendation based on your idea
- **Sample Size Calculation**: Deterministic statistical methods
- **Document Generation**: Protocol, SAP, CRF, PIS/ICF, IEC cover notes
- **AI Enhancement**: Optional AI-powered narrative generation (requires API key)
- **Compliance Checking**: Pre-launch checklist with blocking issues
- **Baseline Pack Export**: Download complete package as ZIP

## Architecture

- **Monorepo**: npm workspaces
- **Frontend**: Next.js 14 (App Router) with TypeScript and Tailwind CSS
- **Backend**: Express.js API with TypeScript
- **Core Logic**: Deterministic functions in `packages/core`
- **AI Integration**: Backend-only LLM calls through `services/api/src/llm.ts`

## Compliance & Guardrails

Per `AGENTS.md` and `RULEBOOK.md`:

- ✅ Never claims IEC/IRB/CTRI/DCGI approvals
- ✅ Never fabricates approval numbers or IDs
- ✅ Deterministic logic is source of truth for designs, sample sizes, endpoints
- ✅ AI only generates narrative text, never changes computed values
- ✅ All outputs marked as "AI-generated draft — requires PI/IEC review"

## Known Issues

- **Build Type Checking**: Next.js build has a TypeScript module resolution issue with workspace packages. The dev server works correctly, and this is a type-checking-only issue (runtime is fine). Workaround: Use `npm run dev:web` for development.

## License

MIT
