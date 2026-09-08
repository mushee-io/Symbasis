import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  const input = (await request.json()) as RiskRequest;
  const collateral = Math.max(0, Number(input.collateral ?? 0));
  const margin = Math.max(0, Number(input.margin ?? 0));
  const leverage = clamp(Number(input.leverage ?? 1), 1, 20);
  const price = Math.max(0, Number(input.price ?? 0));
  const volatility = clamp(Number(input.volatilityPct ?? 3), 0, 50);
  const funding = clamp(Number(input.fundingBpsPerDay ?? 0), -1000, 1000);

  if (!Number.isFinite(collateral + margin + leverage + price + volatility + funding)) {
    return NextResponse.json({ error: "Invalid numeric input" }, { status: 400 });
  }

  const concentration = collateral > 0 ? clamp(margin / collateral, 0, 1.5) : 1;
  const leverageRisk = clamp((leverage - 1) / 9, 0, 1);
  const concentrationRisk = clamp(concentration / 0.5, 0, 1);
  const volatilityRisk = clamp(volatility / 12, 0, 1);
  const fundingRisk = clamp(Math.abs(funding) / 150, 0, 1);

  const score = Math.round(
    100 * (0.42 * leverageRisk + 0.28 * concentrationRisk + 0.2 * volatilityRisk + 0.1 * fundingRisk)
  );

  const recommendedLeverage = score >= 75 ? Math.min(2, leverage) : score >= 55 ? Math.min(3, leverage) : Math.min(5, leverage);
  const targetMarginShare = score >= 75 ? 0.1 : score >= 55 ? 0.15 : 0.2;
  const suggestedMargin = collateral > 0 ? Math.min(margin || collateral * targetMarginShare, collateral * targetMarginShare) : margin;
  const suggestedPosition = suggestedMargin * recommendedLeverage;

  // Approximation for a 5% maintenance margin before the contract computes the exact market value.
  const adverseMovePct = Math.max(0, 100 / leverage - 5);
  const liquidationDistance = `${adverseMovePct.toFixed(1)}% adverse move`;

  const warnings: string[] = [];
  if (leverage >= 5) warnings.push("High leverage compresses liquidation distance.");
  if (concentration > 0.25) warnings.push("This trade uses more than 25% of deposited collateral as margin.");
  if (volatility >= 8) warnings.push("Elevated volatility can make market-order slippage and liquidations more likely.");
  if (Math.abs(funding) >= 50) warnings.push("Funding is materially expensive for one side of the market.");
  if (warnings.length === 0) warnings.push("No major baseline risk flags from the supplied inputs.");

  return NextResponse.json({
    score,
    level: score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW",
    recommendedLeverage,
    suggestedMargin: Number(suggestedMargin.toFixed(2)),
    suggestedPosition: Number(suggestedPosition.toFixed(2)),
    liquidationDistance,
    marketPrice: price,
    side: input.side ?? "long",
    warnings,
    model: "Symbasis Risk Baseline v0.1",
    note: "Decision support only. The V1 risk layer does not control wallet funds."
  });
}
