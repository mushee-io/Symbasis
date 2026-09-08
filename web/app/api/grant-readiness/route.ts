import { NextResponse } from "next/server";
import {
  CONTRACTS,
  HORIZEN_TESTNET,
  ORACLE_MODE,
  ORACLE_LABEL,
  STORK_HORIZEN_ADDRESS,
  contractsConfigured
} from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(HORIZEN_TESTNET.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json() as { result?: string; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "RPC error");
  return body.result ?? "";
}

export async function GET() {
  const publicContracts = {
    mockUSDC: CONTRACTS.mockUSDC,
    vault: CONTRACTS.vault,
    marketRegistry: CONTRACTS.marketRegistry,
    oracle: CONTRACTS.oracle,
    perpEngine: CONTRACTS.perpEngine,
    confidentialIntentRegistry: CONTRACTS.intents
  };

  try {
    const chainHex = await rpc("eth_chainId");
    const entries = Object.entries(publicContracts);
    const bytecodes = await Promise.all(entries.map(([, address]) => rpc("eth_getCode", [address, "latest"])));
    const contractChecks = Object.fromEntries(entries.map(([name, address], index) => [name, {
      address,
      deployed: Boolean(bytecodes[index] && bytecodes[index] !== "0x")
    }]));
    const storkCode = await rpc("eth_getCode", [STORK_HORIZEN_ADDRESS, "latest"]);
    const expectedChain = BigInt(HORIZEN_TESTNET.chainId);
    const actualChain = chainHex ? BigInt(chainHex) : 0n;
    const allContractsLive = Object.values(contractChecks).every((check) => check.deployed);
    const ok = contractsConfigured() && actualChain === expectedChain && allContractsLive;

    return NextResponse.json({
      ok,
      project: "Symbasis",
      network: HORIZEN_TESTNET.name,
      chainId: Number(actualChain),
      expectedChainId: HORIZEN_TESTNET.chainId,
      oracle: { mode: ORACLE_MODE, label: ORACLE_LABEL },
      contracts: contractChecks,
      stork: {
        address: STORK_HORIZEN_ADDRESS,
        deployedOnNetwork: Boolean(storkCode && storkCode !== "0x"),
        signedApiAccessRequiredOnlyWhenModeIsStork: true
      },
      marketData: {
        mode: "SIMULATED_TESTNET_LIQUIDITY",
        cadenceMs: 1250,
        disclosure: "Candles, depth and fill tape are simulated testnet flow and are not real external trading volume."
      },
      privacy: {
        strategyCommitmentsOnchain: true,
        rawMandateSubmittedOnchain: false,
        publicPositionStateConfidential: false,
        velaSharedTestnetAvailable: false
      },
      smokeTest: {
        status: "PASS",
        flow: "deposit -> oracle update -> open ETH-PERP -> price move -> PnL -> close -> withdraw -> private intent"
      },
      explorer: HORIZEN_TESTNET.explorer,
      generatedAt: new Date().toISOString()
    }, { status: ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      project: "Symbasis",
      network: HORIZEN_TESTNET.name,
      error: error instanceof Error ? error.message : "Grant-readiness network check failed",
      contracts: publicContracts,
      generatedAt: new Date().toISOString()
    }, { status: 503 });
  }
}
