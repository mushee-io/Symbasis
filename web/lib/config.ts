export const HORIZEN_TESTNET = {
  chainId: 2_651_420,
  chainHex: "0x28751c",
  name: "Horizen Testnet",
  rpcUrl: "https://horizen-testnet.rpc.caldera.xyz/http",
  explorer: "https://explorer-testnet.horizen.io",
  faucet: "https://hub-testnet.horizen.io/",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
} as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  mockUSDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? ZERO_ADDRESS,
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? ZERO_ADDRESS,
  marketRegistry: process.env.NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS ?? ZERO_ADDRESS,
  storkAdapter: process.env.NEXT_PUBLIC_STORK_ADAPTER_ADDRESS ?? ZERO_ADDRESS,
  perpEngine: process.env.NEXT_PUBLIC_PERP_ENGINE_ADDRESS ?? ZERO_ADDRESS,
  intents: process.env.NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS ?? ZERO_ADDRESS
} as const;

export const MARKETS = {
  ETH: {
    key: "ETH",
    symbol: "ETH-PERP",
    asset: "ETHUSD",
    feedId: "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160"
  },
  BTC: {
    key: "BTC",
    symbol: "BTC-PERP",
    asset: "BTCUSD",
    feedId: "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de"
  }
} as const;

export type MarketKey = keyof typeof MARKETS;

export function contractsConfigured() {
  return Object.values(CONTRACTS).every((value) => value !== ZERO_ADDRESS);
}
