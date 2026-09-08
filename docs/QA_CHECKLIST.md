# Symbasis — Grant QA Checklist

## Automated checks — required green before submission

- [x] Solidity/TypeScript contract tooling typecheck
- [x] Solidity compilation
- [x] Contract test suite
- [x] Web production dependency audit
- [x] Web TypeScript typecheck
- [x] Next.js production build
- [x] Horizen testnet RPC connectivity
- [x] Horizen chain ID verification
- [x] Stork contract bytecode verification on Horizen testnet
- [x] Deployment workflow smoke test: PASS

## Deployment proof

- [x] sUSDC deployed
- [x] Vault deployed
- [x] MarketRegistry deployed
- [x] DemoPriceOracle deployed
- [x] PerpEngine deployed
- [x] ConfidentialIntentRegistry deployed
- [x] Public deployment manifest committed
- [x] Public architecture page added
- [x] Live grant-readiness endpoint added

## Terminal UX

- [x] Primary navigation is ALL CAPS
- [x] Home page scrolls normally; no fixed black overlay
- [x] Institutional graphite terminal styling
- [x] ETH/BTC market selection
- [x] Moving OHLC candlesticks
- [x] Volume bars
- [x] 1M/5M/15M/30M/1H/4H/1D timeframe controls
- [x] Dynamic bid/ask depth
- [x] Red/green BUY/SELL fill tape
- [x] Testnet simulation disclosure visible
- [x] Wallet connect / Horizen network switch logic
- [x] sUSDC faucet / approve / deposit / withdraw controls
- [x] Long / short execution
- [x] Leverage and isolated margin display
- [x] Position / liquidation / PnL view
- [x] Advisory risk analysis
- [x] Private strategy commitment flow
- [x] Onchain activity/explorer surface
- [x] Client-side LIMIT/TRIGGER testnet intents with explicit wallet execution

## Honesty / reviewer safety

- [x] Simulated MM activity is not described as real liquidity or volume
- [x] Demo oracle is identified as demo mode
- [x] Stork-ready path is retained without claiming signed access is active
- [x] Public position state is identified as public today
- [x] Shared VELA testnet availability is not overstated
- [x] No claim of professional audit
- [x] Advanced client-side intents are not described as keeper-backed native orders

## One manual browser/wallet pass still required by the account owner

These actions cannot be completed by CI because they require the user's injected wallet and explicit MetaMask approvals:

1. Open the production Vercel `/trade` route in a desktop browser.
2. Confirm the ALL-CAPS navigation and that candles/order book/fill tape move.
3. Connect the funded testnet MetaMask wallet.
4. Confirm automatic switch/add to Horizen Testnet.
5. Claim sUSDC if needed.
6. Approve the Vault.
7. Deposit test collateral.
8. Open one small ETH-PERP position at low leverage.
9. Confirm position, PnL and explorer activity appear.
10. Close the position.
11. Withdraw free collateral.
12. Commit a test private mandate hash.
13. Open `/architecture` and `/api/grant-readiness` and confirm they render successfully.
14. Check one mobile-width view for overflow; use desktop for the recorded grant demo.

If all 14 pass, Symbasis is ready for the grant demo/submission at the current testnet scope.
