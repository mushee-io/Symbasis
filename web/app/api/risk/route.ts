import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;

type RiskRequest = {
  collateral?: number;
  margin?: number;
  leverage?: number;
  price?: number;
  side?: "long" | "short";
  volatilityPct?: number;
  fundingBpsPerDay?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let input: RiskRequest;
  try {
    input = (await request.json()) as RiskRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (input.side !== undefined && input.side !== "long" && input.side !== "short") {
    return NextResponse.json({ error: "Invalid side" }, { status: 400 });
  }

  const collateral = boundedNumber(input.collateral, 0, 0, 1_000_000_000);
  const margin = boundedNumber(input.margin, 0, 0, 1_000_000_000);
  const leverage = boundedNumber(input.leverage, 1, 1, 10);
  const price = boundedNumber(input.price, 0, 0, 10_000_000);
  const volatility = boundedNumber(input.volatilityPct, 3, 0, 50);
  const funding = boundedNumber(input.fundingBpsPerDay, 0, -1_000, 1_000);

  if ([collateral, margin, leverage, price, volatility, funding].some((value) => value === null)) {
    return NextResponse.json({ error: "Risk input is outside supported bounds" }, { status: 400 });
  }

  const safeCollateral = collateral!;
  const safeMargin = margin!;
  const safeLeverage = leverage!;
  const safePrice = price!;
  const safeVolatility = volatility!;
  const safeFunding = funding!;

  if (safeMargin > safeCollateral && safeCollateral > 0) {
    return NextResponse.json({ error: "Margin cannot exceed deposited collateral" }, { status: 400 });
  }

  const concentration = safeCollateral > 0 ? clamp(safeMargin / safeCollateral, 0, 1) : safeMargin > 0 ? 1 : 0;
  const leverageRisk = clamp((safeLeverage - 1) / 9, 0, 1);
  const concentrationRisk = clamp(concentration / 0.5, 0, 1);
  const volatilityRisk = clamp(safeVolatility / 12, 0, 1);
  const fundingRisk = clamp(Math.abs(safeFunding) / 150, 0, 1);

  const score = Math.round(
    100 * (0.42 * leverageRisk + 0.28 * concentrationRisk + 0.2 * volatilityRisk + 0.1 * fundingRisk)
  );

  const recommendedLeverage = score >= 75 ? Math.min(2, safeLeverage) : score >= 55 ? Math.min(3, safeLeverage) : Math.min(5, safeLeverage);
  const targetMarginShare = score >= 75 ? 0.1 : score >= 55 ? 0.15 : 0.2;
  const suggestedMargin = safeCollateral > 0
    ? Math.min(safeMargin || safeCollateral * targetMarginShare, safeCollateral * targetMarginShare)
    : 0;
  const suggestedPosition = suggestedMargin * recommendedLeverage;

  const adverseMovePct = Math.max(0, 100 / safeLeverage - 5);
  const liquidationDistance = `${adverseMovePct.toFixed(1)}% adverse move`;

  const warnings: string[] = [];
  if (safeLeverage >= 5) warnings.push("High leverage compresses liquidation distance.");
  if (concentration > 0.25) warnings.push("This trade uses more than 25% of deposited collateral as margin.");
  if (safeVolatility >= 8) warnings.push("Elevated volatility can make market-order slippage and liquidations more likely.");
  if (Math.abs(safeFunding) >= 50) warnings.push("Funding is materially expensive for one side of the market.");
  if (safePrice <= 0) warnings.push("Refresh the oracle before relying on this estimate.");
  if (warnings.length === 0) warnings.push("No major baseline risk flags from the supplied inputs.");

  return NextResponse.json(
    {
      score,
      level: score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW",
      recommendedLeverage,
      suggestedMargin: Number(suggestedMargin.toFixed(2)),
      suggestedPosition: Number(suggestedPosition.toFixed(2)),
      liquidationDistance,
      marketPrice: safePrice,
      side: input.side ?? "long",
      warnings,
      model: "Symbasis Risk Baseline v0.2",
      note: "Decision support only. The V1 risk layer does not control wallet funds."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}