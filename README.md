# Symbasis

**Private AI Perpetual Exchange on Horizen**

Symbasis is a testnet-first perpetual trading protocol with AI-assisted risk intelligence, privacy-oriented strategy commitments and an autonomous testnet market-making layer. The public trading core is deployed on Horizen testnet.

> Testnet software only. Do not use real funds. Simulated market-maker activity is not real liquidity or volume.

## Reviewer links

- Live app: https://web-vert-eight-44.vercel.app
- Trade terminal: https://web-vert-eight-44.vercel.app/trade
- Architecture: https://web-vert-eight-44.vercel.app/architecture
- Live readiness: https://web-vert-eight-44.vercel.app/api/grant-readiness
- Grant brief: [`GRANT_SUBMISSION.md`](./GRANT_SUBMISSION.md)
- Demo script: [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md)
- QA checklist: [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md)
- Public deployment manifest: [`deployments/horizen-testnet.public.json`](./deployments/horizen-testnet.public.json)

## Horizen testnet

- Chain ID: `2651420`
- RPC: `https://horizen-testnet.rpc.caldera.xyz/http`
- Explorer: `https://explorer-testnet.horizen.io/`
- Faucet / Hub: `https://hub-testnet.horizen.io/`
- Gas token: ETH
- Stork contract: `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`

## Deployed contracts

| Component | Address |
| --- | --- |
| sUSDC | `0x6bb04e5B146c2e9fE1FC80A4936596d6D0627F95` |
| Vault | `0x7762591e96429108d961f5740F99d863E8AD354A` |
| MarketRegistry | `0xaaEe1F794dFF5758543083a515741825c7deE6AE` |
| DemoPriceOracle | `0xFEC5eB2307f974aE08cd7f7A6C57080ABe707275` |
| PerpEngine | `0x296234337BC3589C563De889D9613E3D0D979D1a` |
| ConfidentialIntentRegistry | `0x447a23e847CFFEa73257F5a936d96E81bFe0f4D2` |

The successful deployment workflow completed a full smoke test and produced `status: PASS` for:

`deposit -> oracle update -> open ETH-PERP -> price move -> PnL -> close -> withdraw -> private intent`

## What is implemented

### Trading contracts

- `MockUSDC.sol` — 6-decimal test collateral with a rate-limited public faucet
- `SymbasisVault.sol` — deposits, withdrawals, reserved margin, protocol liquidity and PnL settlement
- `MarketRegistry.sol` — ETH-PERP / BTC-PERP configuration, leverage and OI limits
- `DemoPriceOracle.sol` — testnet-only price path with configured feeds and bounded public moves
- `StorkOracleAdapter.sol` — signed Stork pull-oracle update path, update fee and freshness validation
- `PerpEngine.sol` — long/short, isolated margin, leverage, slippage guards, partial/full closes, PnL, funding framework and liquidation
- `ConfidentialIntentRegistry.sol` — stores strategy commitments and attested result hashes without publishing raw mandate text

### Markets

- `ETH-PERP`
- `BTC-PERP`
- maximum leverage: 10x
- maintenance margin: 5%
- testnet position and open-interest caps

Both oracle modes use the same ETHUSD/BTCUSD feed identifiers, so switching oracle implementations does not require changing market IDs or the trading engine.

### Trading terminal

The Next.js app in `web/` includes:

- all-caps institutional navigation: TRADE / MARKETS / PORTFOLIO / LIQUIDITY / MM / REWARDS / MORE
- injected-wallet connection and automatic Horizen network switch/add
- test sUSDC faucet, approval, deposit and withdrawal
- ETH/BTC perpetual market selection
- moving OHLC candlesticks with green/red bodies and volume bars
- 1M / 5M / 15M / 30M / 1H / 4H / 1D chart controls and crosshair
- dynamic bid/ask depth and red/green BUY/SELL fill tape from Symbasis MM
- clear simulated-testnet disclosure
- long/short market execution, leverage and isolated-margin sizing
- current position, entry, margin, liquidation price and unrealized PnL
- full close / settlement flow
- persistent onchain PerpEngine activity with explorer links
- explainable advisory pre-trade risk scoring
- raw private mandate kept in-browser with onchain hash commitment
- client-side LIMIT/TRIGGER testnet intents that require explicit wallet execution when triggered

## Symbasis MM / market simulation

`web/lib/mm/engine.ts` produces deterministic ETH/BTC testnet market structure on a bounded 1.25-second quote cycle. It generates market regimes, mark/reference/index values, spreads, depth and BUY/SELL fills. The terminal converts that stream into live-style candles, book movement and fill tape.

This layer is **simulation**. It must not be described as real external liquidity, real volume or real counterparties. The configured oracle mark remains a separate settlement reference.

## AI risk layer

`web/app/api/risk/route.ts` provides an explainable risk baseline using leverage, collateral concentration, volatility and funding inputs. It returns a score/level, recommended leverage, suggested margin/position size and risk warnings.

The risk layer is advisory. It cannot sign transactions or control wallet funds.

## Oracle modes

### `demo` — current deployed mode

`DemoPriceOracle` provides the controlled Horizen testnet price path. It uses the same update-facing architecture needed by the terminal while avoiding a dependency on signed Stork API access for the grant demo.

Safety constraints include configured feeds, stale/non-positive price rejection and bounded public price moves.

### `stork` — signed oracle path

`StorkOracleAdapter` supports Stork pull updates and runtime fees. Stork mode requires a server-only `STORK_API_KEY` and a Stork-mode adapter deployment address. Never expose the API key as a `NEXT_PUBLIC_` variable.

## Confidential execution / VELA

Symbasis does **not** claim that current public Horizen testnet positions are confidential.

Current boundary:

1. Raw strategy/agent mandate remains in the browser/offchain.
2. Browser computes a commitment.
3. `ConfidentialIntentRegistry` stores only that commitment.
4. VELA integration is prepared for the supported local environment.
5. Shared VELA testnet execution can replace the attestor path when Horizen makes that environment available.

See [`vela/README.md`](./vela/README.md).

## Install and test contracts

```bash
npm install
cp .env.example .env
npm run typecheck
npm run compile
npm test
npm run check:testnet
```

## Deploy to Horizen testnet

Fund a fresh testnet deployment wallet and set its key securely as `PRIVATE_KEY` locally or `HORIZEN_DEPLOYER_PRIVATE_KEY` in GitHub Actions. Never paste private keys into issues, commits, frontend variables or chat.

Demo mode:

```bash
ORACLE_MODE=demo npm run deploy:testnet
ORACLE_MODE=demo npm run verify:testnet
ORACLE_MODE=demo npm run smoke:testnet
```

Stork mode:

```bash
ORACLE_MODE=stork STORK_API_KEY=... npm run deploy:testnet
ORACLE_MODE=stork STORK_API_KEY=... npm run verify:testnet
ORACLE_MODE=stork STORK_API_KEY=... npm run smoke:testnet
```

## Web configuration

The committed public testnet addresses are the safe default for demo mode, so a fresh Vercel build points at the deployed Horizen contracts even if public address env variables are omitted. Environment variables can override those addresses for future deployments.

`NEXT_PUBLIC_ORACLE_MODE=demo` remains the default. Stork mode intentionally requires explicit deployment-specific oracle configuration.

Run locally:

```bash
cd web
npm install
npm run dev
```

## CI / grant readiness

`.github/workflows/ci.yml` type-checks deployment tooling, compiles contracts, runs the full test suite, audits production web dependencies, type-checks/builds the frontend, and checks live Horizen testnet connectivity.

The public `/api/grant-readiness` endpoint additionally checks chain ID and deployed contract bytecode from the running web application.

## Security notes / limitations

- testnet only; no professional smart-contract audit yet
- demo/MM values are simulated and clearly disclosed
- stale/non-positive oracle prices are rejected
- market-order slippage is bounded
- leverage and open interest are capped
- margin is reserved at the vault level
- isolated position losses are capped at posted position margin
- emergency pause blocks new risk while preserving exits/liquidations
- privileged ownership transfers use two-step acceptance where implemented
- advanced LIMIT/TRIGGER intents are browser-side testnet intents, not keeper-backed native orders
- funding accounting is MVP-grade and should move to cumulative funding indices before production
- shared VELA testnet privacy is not currently available
