# Symbasis

**Private AI Perpetual Exchange on Horizen**

Symbasis is being built testnet-first on Horizen. The first milestone is deliberately simple: prove that the app can connect to the correct Horizen testnet, deploy real contracts, and move test collateral safely before adding perpetual-market and confidential-compute complexity.

## Horizen Testnet

- Chain ID: `2651420`
- RPC: `https://horizen-testnet.rpc.caldera.xyz/http`
- Explorer: `https://explorer-testnet.horizen.io/`
- Faucet / Hub: `https://hub-testnet.horizen.io/`
- Gas token: ETH

## Milestone 1 — chain foundation

Implemented:

- Hardhat + TypeScript project
- Horizen testnet configuration
- `.env` secret handling
- strict chain-ID deployment guard
- live network health-check script
- `SymbasisVault` test collateral contract
- deposit / withdrawal contract tests

## Local setup

```bash
npm install
cp .env.example .env
npm run compile
npm test
npm run check:testnet
```

## Testnet deployment

Fund the deployment wallet with Horizen testnet ETH from the official faucet, then put the wallet private key in `.env` locally:

```env
PRIVATE_KEY=0x...
```

Never commit `.env` or a real private key.

Deploy:

```bash
npm run deploy:testnet
```

The deployment script verifies chain ID `2651420` before broadcasting. If the wallet is connected to any other chain, deployment aborts.

## Build sequence

1. **Network & collateral foundation** — current milestone
2. **Mock perpetual engine** — long/short, leverage, PnL, margin, liquidation rules
3. **Oracle integration** — Horizen testnet price feed / Stork
4. **Trading terminal** — wallet connect, positions, order ticket, portfolio state
5. **AI risk engine** — leverage/risk recommendations with explicit deterministic guardrails
6. **Confidential execution** — integrate Horizen VELA for sensitive strategy/order computation where appropriate
7. **End-to-end testnet demo** — wallet → collateral → private intent → execution → position → close/settle

## Security rule

This repository must never contain a production private key, seed phrase, API secret, or funded-wallet credential.
