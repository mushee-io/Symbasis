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
- Stork oracle: `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`

## What is implemented

### Trading contracts

- `MockUSDC.sol` — 6-decimal test collateral with a rate-limited public faucet
- `SymbasisVault.sol` — deposits, withdrawals, reserved margin, protocol liquidity and PnL settlement
- `MarketRegistry.sol` — ETH-PERP / BTC-PERP market configuration, leverage and OI limits
- `StorkOracleAdapter.sol` — Stork pull-oracle updates, runtime update fee, freshness checks and invalid-price rejection
- `PerpEngine.sol` — long/short positions, isolated margin, leverage, slippage guards, partial/full closes, PnL, funding framework, liquidation, position/OI caps
- `ConfidentialIntentRegistry.sol` — stores private-strategy commitments and attested result hashes without publishing raw mandates

### Markets

Deployment config creates:

- `ETH-PERP` using Stork `ETHUSD`
- `BTC-PERP` using Stork `BTCUSD`
- max leverage: 10x
- maintenance margin: 5%
- testnet position and open-interest caps

### Trading terminal

The Next.js app in `web/` includes:

- MetaMask / injected-wallet connection
- automatic Horizen testnet switch/add
- Horizen faucet link and gas balance
- test sUSDC faucet, approval, deposit and withdrawal
- ETH/BTC market selector
- real-session Stork price trace
- long / short order ticket
- leverage slider and position sizing
- 0.5% market-order slippage protection
- current position, entry, margin, liquidation price and unrealized PnL
- full close / settlement flow
- session transaction history with explorer links
- advisory pre-trade risk scoring
- private mandate commitment flow

## AI risk layer

`web/app/api/risk/route.ts` provides an explainable V1 risk baseline using leverage, collateral concentration, volatility and funding inputs. It returns:

- risk score and level
- recommended leverage
- suggested margin / position size
- approximate liquidation-distance warning
- human-readable risk flags

V1 is intentionally advisory. It cannot sign transactions or control wallet funds.

## Stork integration

Stork is a pull oracle. The web server fetches the latest signed payload from Stork, preserves nanosecond timestamps and price integers as strings, then the wallet pushes the signed update through `StorkOracleAdapter` before trading.

Set this **server-side only** in `web/.env.local`:

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

Start the official VELA local stack:

```bash
./scripts/vela-local.sh
```

## Install and test contracts

```bash
npm install
cp .env.example .env
npm run compile
npm test
npm run check:testnet
```

The suite covers:

- 6-decimal collateral precision
- margin reservation / withdrawal blocking
- long and short PnL
- partial closes
- funding
- permissionless liquidation
- slippage rejection
- emergency pause controls
- owner/engine authorization
- stale Stork price rejection
- randomized isolated-loss bound checks
- confidential-intent permissions

## Deploy to Horizen testnet

Fund a deployment wallet with Horizen testnet ETH, then set locally:

```env
PRIVATE_KEY=0x...
```

Deploy:

```bash
npm run deploy:testnet
```

The deployment script refuses to broadcast unless the connected chain ID is exactly `2651420`, deploys the full stack, creates ETH/BTC markets, seeds protocol test liquidity and writes:

```text
deployments/horizen-testnet.json
```

Copy the resulting addresses into `web/.env.local`:

```env
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_STORK_ADAPTER_ADDRESS=0x...
NEXT_PUBLIC_PERP_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS=0x...
```

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
→ refresh signed Stork price
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

`.github/workflows/ci.yml` compiles contracts, runs all tests, type-checks the frontend and runs a production Next.js build on every push / pull request.

## Security notes

- testnet only
- private keys and API secrets must never be committed
- stale and non-positive oracle prices are rejected
- market-order slippage is bounded
- leverage and open interest are capped
- margin is reserved at the vault level
- isolated position losses are capped at posted position margin
- contracts have owner / engine authorization and emergency pause controls
- this repository has not received a professional smart-contract audit
