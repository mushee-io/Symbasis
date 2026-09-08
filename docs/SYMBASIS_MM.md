# Symbasis MM

Symbasis MM is the testnet market-making and market-simulation layer for the Symbasis perpetual exchange.

It has two responsibilities:

1. Make the trading terminal behave like a live perpetual market with moving prices, a two-sided book, spreads, depth and a red/green trade tape.
2. In `demo` oracle mode, feed the same moving simulated mark into `DemoPriceOracle`, so real Horizen testnet position opens/closes can settle against a changing onchain test price.

It never replaces or fabricates Stork data when Symbasis is running in `stork` oracle mode.

## Components

### `web/lib/mm/engine.ts`

Pure deterministic market engine. It generates:

- ETH-PERP and BTC-PERP mark/reference/index prices
- CALM, TREND_UP, TREND_DOWN and VOLATILE regimes
- dynamic spreads
- multi-level bid and ask depth
- cumulative book size
- BUY/SELL trade tape
- simulated 24-hour change and volatility telemetry

The engine is deterministic for a given market, timestamp and anchor price. This makes it serverless-safe and testable without storing fake exchange state in Vercel memory.

### `GET /api/mm`

Returns a complete MM snapshot.

Examples:

```text
/api/mm?market=ETH
/api/mm?market=BTC&levels=16&trades=24
/api/mm?market=ETH&anchor=3500
```

Depth is clamped to 4-24 levels and the tape to 4-40 trades.

### `/mm`

Dedicated live MM console. It polls approximately every 1.25 seconds and renders:

- live mark/index/bid/ask
- spread
- simulated 24-hour move
- market-regime telemetry
- moving price trace
- order book
- trade tape

### Demo oracle integration

When `NEXT_PUBLIC_ORACLE_MODE=demo`, `/api/stork-price` uses the MM engine instead of a fixed demo price. The response retains the existing Stork-compatible update structure, so the current frontend transaction path can call `DemoPriceOracle.updatePrices` without a separate UI implementation.

The DemoPriceOracle contract enforces a maximum 5% public step per update, and the MM engine normally moves far less than that.

When `NEXT_PUBLIC_ORACLE_MODE=stork`, the MM engine does not modify signed Stork data or the Stork adapter.

## Commands

Run the offchain simulator locally:

```bash
npm run mm:simulate
```

Optional environment variables:

```text
MM_MARKET=ETH
MM_ANCHOR_PRICE=3500
MM_INTERVAL_MS=1250
```

Run the onchain DemoPriceOracle bot against Horizen testnet:

```bash
npm run mm:oracle:testnet
```

The command requires a funded testnet signer and a deployed `DemoPriceOracle`. It refuses to run on any chain other than Horizen testnet and refuses to run if the configured oracle does not expose the DemoPriceOracle guard surface.

Optional environment variables:

```text
MM_ORACLE_ADDRESS=0x...
MM_ETH_ANCHOR=3500
MM_BTC_ANCHOR=110000
MM_ORACLE_INTERVAL_MS=15000
```

If `MM_ORACLE_ADDRESS` is omitted, the bot attempts to read `contracts.oracle` from `deployments/horizen-testnet.json`.

## Testnet flow

```text
MM engine
   |
   +--> /api/mm ------------------> /mm order book + chart + trade tape
   |
   +--> /api/stork-price (demo) --> DemoPriceOracle.updatePrices
                                      |
                                      v
                                  PerpEngine
                                      |
                         open / close / PnL / liquidation
```

Stork mode remains:

```text
Stork signed update --> StorkOracleAdapter --> PerpEngine
```

## Safety boundary

Symbasis MM is explicitly testnet simulation infrastructure. It must not be represented as real volume, real counterparties, real liquidity or a production price source. Production markets should use an authenticated oracle and a real execution/liquidity design.
