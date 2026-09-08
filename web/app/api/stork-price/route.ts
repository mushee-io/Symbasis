import { NextRequest, NextResponse } from "next/server";
import { generateMMSnapshot, MMMarketKey } from "@/lib/mm/engine";

const STORK_API = "https://rest.jp.stork-oracle.network/v1/prices/latest";
const ALLOWED_ASSETS = new Set(["ETHUSD", "BTCUSD"]);
const FEEDS: Record<string, string> = {
  ETHUSD: "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160",
  BTCUSD: "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de"
};
const DEMO_PRICES: Record<string, string> = {
  ETHUSD: process.env.DEMO_ETH_PRICE_18 ?? "3500000000000000000000",
  BTCUSD: process.env.DEMO_BTC_PRICE_18 ?? "110000000000000000000000"
};
const ZERO32 = `0x${"0".repeat(64)}`;
const ONE_18 = 1_000_000_000_000_000_000n;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  existing.count += 1;
  return existing.count > 30;
}

function price18ToNumber(value: string) {
  const raw = BigInt(value);
  const whole = raw / ONE_18;
  const fraction = (raw % ONE_18) / 1_000_000_000_000n;
  return Number(whole) + Number(fraction) / 1_000_000;
}

function numberToPrice18(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid MM price");
  const fixed = value.toFixed(8);
  const [whole, fraction = ""] = fixed.split(".");
  return (BigInt(whole) * ONE_18 + BigInt(fraction.padEnd(18, "0").slice(0, 18))).toString();
}

function demoPayload(asset: string) {
  const market = asset.startsWith("BTC") ? "BTC" : "ETH" as MMMarketKey;
  const anchorPrice = price18ToNumber(DEMO_PRICES[asset]);
  const snapshot = generateMMSnapshot({ market, anchorPrice, levels: 8, tradeCount: 8 });
  const quantizedValue = numberToPrice18(snapshot.markPrice);

  return {
    asset,
    source: "demo-mm",
    testnetOnly: true,
    mm: {
      sequence: snapshot.sequence,
      regime: snapshot.regime,
      markPrice: snapshot.markPrice,
      indexPrice: snapshot.indexPrice,
      spreadBps: snapshot.spreadBps,
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk
    },
    updateData: [{
      temporalNumericValue: {
        timestampNs: String(BigInt(Date.now()) * 1_000_000n),
        quantizedValue
      },
      id: FEEDS[asset],
      publisherMerkleRoot: ZERO32,
      valueComputeAlgHash: ZERO32,
      r: ZERO32,
      s: ZERO32,
      v: 27
    }]
  };
}

export async function GET(request: NextRequest) {
  if (rateLimit(request)) return NextResponse.json({ error: "Too many oracle requests" }, { status: 429 });

  const asset = (request.nextUrl.searchParams.get("asset") ?? "ETHUSD").toUpperCase();
  if (!ALLOWED_ASSETS.has(asset)) return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });

  const oracleMode = (process.env.NEXT_PUBLIC_ORACLE_MODE ?? process.env.ORACLE_MODE ?? "demo").toLowerCase();
  if (oracleMode === "demo") {
    return NextResponse.json(demoPayload(asset), {
      headers: { "cache-control": "no-store", "x-symbasis-oracle-mode": "demo-mm" }
    });
  }

  const apiKey = process.env.STORK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "STORK_API_KEY is required when oracle mode is stork" }, { status: 503 });
  }

  let response: Response;
  try {
    response = await fetch(`${STORK_API}?assets=${asset}`, {
      headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    return NextResponse.json({ error: "Stork request timed out or failed" }, { status: 504 });
  }

  if (!response.ok) return NextResponse.json({ error: `Stork API returned ${response.status}` }, { status: 502 });

  const rawText = await response.text();
  if (!rawText || rawText.length > 1_000_000) return NextResponse.json({ error: "Invalid Stork response size" }, { status: 502 });

  const safeText = rawText.replace(/:(\s*)(-?\d{16,})([,}\]])/g, `:$1"$2"$3`);
  let body: any;
  try {
    body = JSON.parse(safeText);
  } catch {
    return NextResponse.json({ error: "Stork returned malformed JSON" }, { status: 502 });
  }

  const entry = body?.data?.[asset];
  const signed = entry?.stork_signed_price;
  const signature = signed?.timestamped_signature?.signature;
  if (!signed || !signature) return NextResponse.json({ error: `No signed ${asset} price returned` }, { status: 502 });

  const checksum = String(signed.calculation_alg?.checksum ?? "");
  const updateData = [{
    temporalNumericValue: {
      timestampNs: String(signed.timestamped_signature.timestamp),
      quantizedValue: String(signed.price)
    },
    id: signed.encoded_asset_id,
    publisherMerkleRoot: signed.publisher_merkle_root,
    valueComputeAlgHash: checksum.startsWith("0x") ? checksum : `0x${checksum}`,
    r: signature.r,
    s: signature.s,
    v: typeof signature.v === "string" ? Number(signature.v) : signature.v
  }];

  return NextResponse.json({ asset, source: "stork", testnetOnly: true, updateData }, {
    headers: { "cache-control": "no-store", "x-symbasis-oracle-mode": "stork" }
  });
}
