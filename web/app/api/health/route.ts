import { NextResponse } from "next/server";

const RPC_URL = "https://horizen-testnet.rpc.caldera.xyz/http";
const EXPECTED_CHAIN_HEX = "0x28751c";
const CONTRACT_ENV = [
  "NEXT_PUBLIC_MOCK_USDC_ADDRESS",
  "NEXT_PUBLIC_VAULT_ADDRESS",
  "NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS",
  "NEXT_PUBLIC_PERP_ENGINE_ADDRESS",
  "NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS"
] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validAddress(value: string | undefined) {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value));
}

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error("RPC returned an error");
  return payload?.result;
}

export async function GET() {
  const oracleMode = (process.env.NEXT_PUBLIC_ORACLE_MODE ?? process.env.ORACLE_MODE ?? "demo").toLowerCase();
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS ?? process.env.NEXT_PUBLIC_STORK_ADAPTER_ADDRESS ?? "";
  const addresses = Object.fromEntries(CONTRACT_ENV.map((name) => [name, process.env[name] ?? ""]));
  const coreConfigured = CONTRACT_ENV.every((name) => validAddress(process.env[name]));
  const oracleConfigured = validAddress(oracleAddress);
  const configured = coreConfigured && oracleConfigured;
  const storkCredentialRequired = oracleMode === "stork";
  const storkConfigured = Boolean(process.env.STORK_API_KEY);

  let chainOk = false;
  let contractsOk = false;
  let latestBlock: number | null = null;

  try {
    const [chainId, blockHex] = await Promise.all([rpc("eth_chainId"), rpc("eth_blockNumber")]);
    chainOk = String(chainId).toLowerCase() === EXPECTED_CHAIN_HEX;
    latestBlock = Number.parseInt(String(blockHex), 16);

    if (configured && chainOk) {
      const contractAddresses = [...CONTRACT_ENV.map((name) => addresses[name]), oracleAddress];
      const codes = await Promise.all(contractAddresses.map((address) => rpc("eth_getCode", [address, "latest"])));
      contractsOk = codes.every((code) => typeof code === "string" && code !== "0x");
    }
  } catch {
    chainOk = false;
    contractsOk = false;
  }

  const credentialOk = !storkCredentialRequired || storkConfigured;
  const ready = configured && credentialOk && chainOk && contractsOk;
  return NextResponse.json(
    {
      service: "symbasis-web",
      environment: "horizen-testnet",
      oracleMode,
      ready,
      checks: {
        contractsConfigured: configured,
        oracleConfigured,
        storkCredentialRequired,
        storkConfigured,
        chainReachable: chainOk,
        deployedBytecodePresent: contractsOk
      },
      latestBlock
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
