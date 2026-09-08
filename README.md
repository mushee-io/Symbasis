# Symbasis

**Private AI Perpetual Exchange on Horizen**

Symbasis is a testnet-first perpetual trading protocol with AI-assisted risk intelligence and a confidential-intent architecture. The public trading core runs on Horizen testnet. Sensitive strategy/agent mandates are committed onchain as hashes and are being integrated with Horizen VELA in the local environment VELA currently supports.

> Testnet software only. Do not use real funds.

## Horizen testnet

- Chain ID: `2651420`
- RPC: `https://horizen-testnet.rpc.caldera.xyz/http`
- Explorer: `https://explorer-testnet.horizen.io/`
- Faucet / Hub: `https://hub-testnet.horizen.io/`
- Gas token: ETH
- Stork contract: `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`

## What is implemented

### Trading contracts

- `MockUSDC.sol` — 6-decimal test collateral with a rate-limited public faucet
- `SymbasisVault.sol` — deposits, withdrawals, reserved margin, protocol liquidity and PnL settlement
- `MarketRegistry.sol` — ETH-PERP / BTC-PERP market configuration, leverage and OI limits
- `DemoPriceOracle.sol` — testnet-only, Stork-compatible update surface with configured feeds and bounded public price moves
- `StorkOracleAdapter.sol` — Stork pull-oracle updates, runtime update fee, freshness checks and invalid-price rejection
- `PerpEngine.sol` — long/short positions, isolated margin, leverage, slippage guards, partial/full closes, PnL, funding framework, liquidation, position/OI caps
- `ConfidentialIntentRegistry.sol` — stores private-strategy commitments and attested result hashes without publishing raw mandates

### Markets

Deployment creates:

- `ETH-PERP`
- `BTC-PERP`
- max leverage: 10x
- maintenance margin: 5%
- testnet position and open-interest caps

Both oracle modes use the same ETHUSD/BTCUSD feed identifiers, so switching oracle implementations does not require changing market IDs or the trading engine.

### Trading terminal

The Next.js app in `web/` includes:

- MetaMask / injected-wallet connection
- automatic Horizen testnet switch/add
- Horizen faucet link and gas balance
- test sUSDC faucet, approval, deposit and withdrawal
- ETH/BTC market selector
- live-session oracle price trace
- long / short order ticket
- leverage slider and position sizing
- 0.5% market-order slippage protection
- current position, entry, margin, liquidation price and unrealized PnL
- full close / settlement flow
- session transaction history with explorer links
- advisory pre-trade risk scoring
- private mandate commitment flow

## AI risk layer

`web/app/api/risk/route.ts` provides an explainable V1 risk baseline using leverage, collateral concentration, volatility and funding inputs. It returns risk score/level, recommended leverage, suggested margin/position size, an approximate liquidation-distance warning, and human-readable risk flags.

V1 is intentionally advisory. It cannot sign transactions or control wallet funds.

## Oracle modes

Symbasis now has two explicit testnet deployment modes.

### `demo` — default / no Stork API key required

`DemoPriceOracle` is deployed on Horizen testnet and seeded with test ETH/BTC prices. It intentionally exposes a Stork-compatible `getUpdateFee` / `updatePrices` interface so the frontend uses the same transaction path in both modes.

Safety constraints:

- testnet-only contract
- only owner can configure feeds
- unknown feeds rejected
- public price updates limited to ±5% per transaction
- stale prices rejected
- no oracle fee
- signature fields are ignored only in demo mode

This proves the complete protocol flow without presenting the data as live market data.

### `stork` — signed oracle mode

`StorkOracleAdapter` fetches and verifies the Stork contract's signed pull-oracle updates. The server-side API key is required only for this mode:

```env
STORK_API_KEY=...
```

Never expose the Stork API key as a `NEXT_PUBLIC_` variable.

## Confidential execution / VELA

Horizen currently documents VELA shared testnet/mainnet deployment as unavailable; local Docker development uses an emulated TEE. Symbasis therefore does not claim that the live Horizen testnet perp state is VELA-private today.

Current privacy path:

1. Raw strategy/agent mandate remains offchain.
2. Browser computes a commitment.
3. `ConfidentialIntentRegistry` stores only the commitment.
4. A VELA guest evaluates the mandate privately in the supported local environment.
5. Only approved result + attestation hashes should be attached onchain.
6. When shared VELA testnet deployment becomes available, the attestor can be replaced with the real VELA execution flow.

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

The suite covers collateral precision, margin reservation, long/short PnL, partial closes, funding, liquidation, slippage, emergency exits, authorization, stale Stork data, demo-oracle bounds, isolated-loss invariants, and confidential-intent permissions.

## Deploy to Horizen testnet

Fund a fresh deployment wallet with Horizen testnet ETH and set its key securely as `PRIVATE_KEY` locally or `HORIZEN_DEPLOYER_PRIVATE_KEY` in the GitHub `horizen-testnet` environment.

Do not paste private keys into issues, commits, chat, or frontend environment variables.

### Deploy now without Stork

```bash
ORACLE_MODE=demo npm run deploy:testnet
ORACLE_MODE=demo npm run verify:testnet
ORACLE_MODE=demo npm run smoke:testnet
```

### Deploy with Stork later

```bash
ORACLE_MODE=stork STORK_API_KEY=... npm run deploy:testnet
ORACLE_MODE=stork STORK_API_KEY=... npm run verify:testnet
ORACLE_MODE=stork STORK_API_KEY=... npm run smoke:testnet
```

The GitHub **Deploy Horizen Testnet** workflow also exposes `demo` / `stork` as a dropdown. `demo` is the default and requires only the funded deployer secret.

A successful deployment writes:

```text
deployments/horizen-testnet.json
deployments/horizen-testnet.web.env
deployments/horizen-testnet-smoke.json
```

The smoke artifact must contain:

```json
{ "status": "PASS" }
```

The smoke test performs a real sequence against the deployed Horizen contracts:

```text
mint/claim sUSDC
→ approve vault
→ deposit collateral
→ update oracle
→ open ETH-PERP long
→ confirm position exists
→ update price again
→ verify PnL
→ close position
→ confirm margin released
→ withdraw collateral
→ commit private strategy hash
→ PASS
```

## Web environment

The deployment script generates `deployments/horizen-testnet.web.env`. Use those values in Vercel or `web/.env.local`.

Important variables include:

```env
NEXT_PUBLIC_ORACLE_MODE=demo
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_STORK_ADAPTER_ADDRESS=0x...
NEXT_PUBLIC_PERP_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS=0x...
```

`NEXT_PUBLIC_STORK_ADAPTER_ADDRESS` is retained as a backwards-compatible frontend alias and points to the selected oracle contract.

## Run the trading terminal

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## End-to-end demo definition

A successful Symbasis testnet demo is:

```text
Connect wallet
→ switch to Horizen testnet
→ get test ETH
→ claim sUSDC
→ approve vault
→ deposit collateral
→ refresh selected oracle
→ run Symbasis risk analysis
→ open ETH/BTC long or short
→ observe margin + PnL + liquidation price
→ refresh oracle
→ reduce/close position
→ settle PnL
→ withdraw free collateral
→ optionally commit a private agent mandate
```

## CI

`.github/workflows/ci.yml` type-checks deployment tooling, compiles contracts, runs the full test suite, audits production web dependencies, type-checks/builds the frontend, and checks live Horizen testnet connectivity on every push / pull request.

## Security notes

- testnet only
- private keys and API secrets must never be committed
- demo oracle values are explicitly simulated and must not be represented as live market data
- stale/non-positive oracle prices are rejected
- market-order slippage is bounded
- leverage and open interest are capped
- margin is reserved at the vault level
- isolated position losses are capped at posted position margin
- emergency pause blocks new risk while preserving exits/liquidations
- privileged ownership transfers use two-step acceptance
- the vault engine is permanently locked after deployment finalization
- this repository has not received a professional smart-contract audit
