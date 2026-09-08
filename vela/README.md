# Symbasis confidential execution (VELA local development)

Symbasis keeps the public perpetual core on Horizen testnet and develops confidential strategy execution against Horizen VELA in the environment VELA currently supports.

## Current platform constraint

At the time this integration was written, Horizen's VELA documentation states that shared testnet/mainnet deployment is not yet available. VELA applications are developed locally with Docker and an emulated TEE. Symbasis therefore does **not** claim that its Horizen testnet perp positions are hidden by VELA today.

What Symbasis does on public Horizen testnet now:

- `ConfidentialIntentRegistry` stores only a `bytes32` commitment to a private mandate.
- The raw mandate stays off-chain/private.
- An attestor address can later bind a VELA result hash + attestation hash to the intent without publishing the raw strategy.

What the VELA module is intended to process privately:

- maximum leverage
- maximum position size
- risk-per-trade limit
- stop-loss / take-profit intent
- volatility rules
- permitted markets
- AI/agent execution instructions

## Local VELA stack

Use the official starter kit rather than vendoring the VELA platform into this repository:

```bash
./scripts/vela-local.sh
```

That helper clones/updates `HorizenOfficial/vela-starterkit`, copies its development environment file, and starts the Docker stack.

The VELA guest application interface described by the official starter kit uses TinyGo/WASM exports such as `deploy` and `process_request`, returning results through the shared VELA WASM types. A Symbasis guest should expose commands equivalent to:

```json
{
  "command": "evaluate_mandate",
  "intentId": "0x...",
  "market": "ETH-PERP",
  "markPrice": "3500000000000000000000",
  "requestedMargin": "500000000",
  "requestedLeverageBps": 30000,
  "privateMandate": {
    "maxLeverageBps": 30000,
    "maxPositionUsd": "5000000000",
    "maxRiskBps": 200,
    "allowedMarkets": ["ETH-PERP", "BTC-PERP"],
    "volatilityCutoffBps": 800
  }
}
```

The guest returns a minimal public result such as:

```json
{
  "intentId": "0x...",
  "approved": true,
  "approvedLeverageBps": 30000,
  "approvedMargin": "500000000",
  "resultHash": "0x..."
}
```

Raw mandate fields should never be emitted as public events. The on-chain `ConfidentialIntentRegistry` receives only the commitment and the attested result hashes.

## Commitment convention

The web app currently commits:

```text
keccak256(UTF8(privateMandateText))
```

For a production-grade VELA guest, migrate to deterministic typed serialization before hashing (for example a versioned canonical JSON or ABI-encoded schema) so the TEE and browser can reproduce the same commitment exactly.

## Promotion path

1. Test the public perp engine on Horizen testnet.
2. Run VELA locally using the official Docker stack.
3. Implement the Symbasis WASM guest against the current VELA shared libraries.
4. Verify the intent commitment inside the confidential guest.
5. Return only approved execution parameters + result hash.
6. Record the corresponding attestation hash in `ConfidentialIntentRegistry`.
7. When Horizen exposes shared VELA testnet deployment, replace the local attestor with the real VELA execution/attestation flow.
