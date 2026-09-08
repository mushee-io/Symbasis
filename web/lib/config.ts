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

/**
 * Public addresses from the successful Symbasis Horizen testnet deployment.
 * These are intentionally committed: contract addresses are public chain data,
 * not secrets. Environment variables can still override them for future deployments.
 */
export const DEPLOYED_HORIZEN_TESTNET = {
  mockUSDC: "0x6bb04e5B146c2e9fE1FC80A4936596d6D0627F95",
  vault: "0x7762591e96429108d961f5740F99d863E8AD354A",
  marketRegistry: "0xaaEe1F794dFF5758543083a515741825c7deE6AE",
  demoOracle: "0xFEC5eB2307f974aE08cd7f7A6C57080ABe707275",
  perpEngine: "0x296234337BC3589C563De889D9613E3D0D979D1a",
  intents: "0x447a23e847CFFEa73257F5a936d96E81bFe0f4D2"
} as const;

export const STORK_HORIZEN_ADDRESS = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";
export const ORACLE_MODE = (process.env.NEXT_PUBLIC_ORACLE_MODE ?? "demo").toLowerCase() === "stork" ? "stork" : "demo";
export const ORACLE_LABEL = ORACLE_MODE === "stork" ? "STORK" : "DEMO ORACLE";

// The committed fallback is valid only for demo mode. Stork mode deliberately
// requires a deployment-specific adapter address through the environment.
const defaultOracle = ORACLE_MODE === "demo" ? DEPLOYED_HORIZEN_TESTNET.demoOracle : ZERO_ADDRESS;
const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS ?? process.env.NEXT_PUBLIC_STORK_ADAPTER_ADDRESS ?? defaultOracle;

export const CONTRACTS = {
  mockUSDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? DEPLOYED_HORIZEN_TESTNET.mockUSDC,
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? DEPLOYED_HORIZEN_TESTNET.vault,
  marketRegistry: process.env.NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS ?? DEPLOYED_HORIZEN_TESTNET.marketRegistry,
  oracle: oracleAddress,
  storkAdapter: oracleAddress,
  perpEngine: process.env.NEXT_PUBLIC_PERP_ENGINE_ADDRESS ?? DEPLOYED_HORIZEN_TESTNET.perpEngine,
  intents: process.env.NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS ?? DEPLOYED_HORIZEN_TESTNET.intents
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
