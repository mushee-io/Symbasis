import { NextRequest, NextResponse } from "next/server";

const STORK_API = "https://rest.jp.stork-oracle.network/v1/prices/latest";
const ALLOWED_ASSETS = new Set(["ETHUSD", "BTCUSD"]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_UPSTREAM_BYTES = 1_000_000;
const CACHE_MS = 2_000;

type RateState = { count: number; resetAt: number };
type CacheState = { expiresAt: number; payload: unknown };

const rateState = new Map<string, RateState>();
const payloadCache = new Map<string, CacheState>();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateState.get(key);
  if (!current || current.resetAt <= now) {
    rateState.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function hex(value: unknown, bytes?: number) {
  const text = String(value ?? "");
  const expected = bytes ? bytes * 2 : undefined;
  if (!/^0x[0-9a-fA-F]+$/.test(text)) return null;
  if (expected && text.length !== expected + 2) return null;
  return text;
}

export async function GET(request: NextRequest) {
  const asset = (request.nextUrl.searchParams.get("asset") ?? "ETHUSD").toUpperCase();
  if (!ALLOWED_ASSETS.has(asset)) {
    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "Too many oracle refresh requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const cached = payloadCache.get(asset);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const apiKey = process.env.STORK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Oracle service is not configured" },
      { status: 503 }
    );
  }

  let response: Response;
  try {
    response = await fetch(`${STORK_API}?assets=${encodeURIComponent(asset)}`, {
      headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(7_000)
    });
  } catch {
    return NextResponse.json({ error: "Stork oracle request timed out" }, { status: 504 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Stork oracle is temporarily unavailable" },
      { status: 502 }
    );
  }

  const rawText = await response.text();
  if (rawText.length === 0 || rawText.length > MAX_UPSTREAM_BYTES) {
    return NextResponse.json({ error: "Invalid Stork response size" }, { status: 502 });
  }

  let body: any;
  try {
    // Stork timestamps are nanoseconds and exceed JavaScript's safe integer range.
    const safeText = rawText.replace(/:(\s*)(-?\d{16,})([,}\]])/g, `:$1"$2"$3`);
    body = JSON.parse(safeText);
  } catch {
    return NextResponse.json({ error: "Malformed Stork response" }, { status: 502 });
  }

  const entry = body?.data?.[asset];
  const signed = entry?.stork_signed_price;
  const signature = signed?.timestamped_signature?.signature;
  if (!signed || !signature) {
    return NextResponse.json({ error: `No signed ${asset} price returned` }, { status: 502 });
  }

  const timestampNs = String(signed.timestamped_signature?.timestamp ?? "");
  const quantizedValue = String(signed.price ?? "");
  if (!/^\d{16,}$/.test(timestampNs) || !/^-?\d+$/.test(quantizedValue)) {
    return NextResponse.json({ error: "Invalid signed numeric values" }, { status: 502 });
  }

  const encodedAssetId = hex(signed.encoded_asset_id, 32);
  const publisherMerkleRoot = hex(signed.publisher_merkle_root, 32);
  const r = hex(signature.r, 32);
  const s = hex(signature.s, 32);
  const checksumRaw = String(signed.calculation_alg?.checksum ?? "");
  const valueComputeAlgHash = hex(checksumRaw.startsWith("0x") ? checksumRaw : `0x${checksumRaw}`, 32);
  const v = Number(signature.v);

  if (!encodedAssetId || !publisherMerkleRoot || !valueComputeAlgHash || !r || !s || !Number.isInteger(v) || v < 0 || v > 255) {
    return NextResponse.json({ error: "Invalid Stork signature payload" }, { status: 502 });
  }

  const payload = {
    asset,
    updateData: [
      {
        temporalNumericValue: { timestampNs, quantizedValue },
        id: encodedAssetId,
        publisherMerkleRoot,
        valueComputeAlgHash,
        r,
        s,
        v
      }
    ]
  };

  payloadCache.set(asset, { expiresAt: Date.now() + CACHE_MS, payload });
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" }
  });
}