import { NextRequest, NextResponse } from "next/server";

const STORK_API = "https://rest.jp.stork-oracle.network/v1/prices/latest";
const ALLOWED_ASSETS = new Set(["ETHUSD", "BTCUSD"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const asset = (request.nextUrl.searchParams.get("asset") ?? "ETHUSD").toUpperCase();
  if (!ALLOWED_ASSETS.has(asset)) {
    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  }

  const apiKey = process.env.STORK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "STORK_API_KEY is not configured on the server" },
      { status: 503 }
    );
  }

  const response = await fetch(`${STORK_API}?assets=${asset}`, {
    headers: { Authorization: `Basic ${apiKey}` },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Stork API returned ${response.status}` },
      { status: response.status }
    );
  }

  // Stork timestamps are nanoseconds and exceed JavaScript's safe integer range.
  // Preserve large integer literals as strings before JSON.parse so signatures remain valid.
  const rawText = await response.text();
  const safeText = rawText.replace(/:(\s*)(-?\d{16,})([,}\]])/g, `:$1"$2"$3`);
  const body = JSON.parse(safeText);
  const entry = body?.data?.[asset];
  const signed = entry?.stork_signed_price;

  if (!signed) {
    return NextResponse.json({ error: `No signed ${asset} price returned` }, { status: 502 });
  }

  const checksum = String(signed.calculation_alg?.checksum ?? "");
  const vRaw = signed.timestamped_signature?.signature?.v;
  const updateData = [
    {
      temporalNumericValue: {
        timestampNs: String(signed.timestamped_signature.timestamp),
        quantizedValue: String(signed.price)
      },
      id: signed.encoded_asset_id,
      publisherMerkleRoot: signed.publisher_merkle_root,
      valueComputeAlgHash: checksum.startsWith("0x") ? checksum : `0x${checksum}`,
      r: signed.timestamped_signature.signature.r,
      s: signed.timestamped_signature.signature.s,
      v: typeof vRaw === "string" ? Number(vRaw) : vRaw
    }
  ];

  return NextResponse.json({ asset, updateData });
}
