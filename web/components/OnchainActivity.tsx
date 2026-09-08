"use client";

import { Contract, JsonRpcProvider } from "ethers";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { CONTRACTS, HORIZEN_TESTNET, ZERO_ADDRESS } from "@/lib/config";

type LedgerItem = {
  block: number;
  action: "OPEN" | "REDUCE" | "LIQUIDATED";
  side?: "LONG" | "SHORT";
  size?: string;
  price?: string;
  pnl?: string;
  tx: string;
};

const EVENT_ABI = [
  "event PositionOpened(address indexed trader,bytes32 indexed marketId,bool isLong,uint256 sizeUsd,uint256 margin,uint256 entryPrice,uint32 leverageBps)",
  "event PositionReduced(address indexed trader,bytes32 indexed marketId,uint256 closedSizeUsd,uint256 releasedMargin,uint256 exitPrice,int256 realizedPnl,uint256 remainingSizeUsd)",
  "event PositionLiquidated(address indexed trader,bytes32 indexed marketId,address indexed liquidator,uint256 exitPrice,int256 realizedPnl)"
];

function usd6(value: bigint | undefined) {
  if (value === undefined) return undefined;
  const numeric = Number(value) / 1_000_000;
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function px18(value: bigint | undefined) {
  if (value === undefined) return undefined;
  const numeric = Number(value) / 1e18;
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function OnchainActivity() {
  const [target, setTarget] = useState<Element | null>(null);
  const [account, setAccount] = useState("");
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [status, setStatus] = useState("CONNECT WALLET TO LOAD ONCHAIN HISTORY");

  useEffect(() => {
    const locate = () => {
      const panel = document.querySelector(".sym-trade-route .history-panel");
      if (panel) setTarget(panel);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum?.request) return;
    const read = async () => {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" }) as string[];
        setAccount(accounts?.[0] ?? "");
      } catch {}
    };
    void read();
    const handler = (accounts: string[]) => setAccount(accounts?.[0] ?? "");
    ethereum.on?.("accountsChanged", handler);
    return () => ethereum.removeListener?.("accountsChanged", handler);
  }, []);

  useEffect(() => {
    if (!account || CONTRACTS.perpEngine === ZERO_ADDRESS) {
      setItems([]);
      setStatus(account ? "PERP ENGINE NOT CONFIGURED" : "CONNECT WALLET TO LOAD ONCHAIN HISTORY");
      return;
    }
    let live = true;
    async function load() {
      try {
        setStatus("SYNCING HORIZEN EVENTS…");
        const provider = new JsonRpcProvider(HORIZEN_TESTNET.rpcUrl, HORIZEN_TESTNET.chainId);
        const latest = await provider.getBlockNumber();
        const from = Math.max(0, latest - 60_000);
        const engine = new Contract(CONTRACTS.perpEngine, EVENT_ABI, provider);
        const [opened, reduced, liquidated] = await Promise.all([
          engine.queryFilter(engine.filters.PositionOpened(account), from, latest),
          engine.queryFilter(engine.filters.PositionReduced(account), from, latest),
          engine.queryFilter(engine.filters.PositionLiquidated(account), from, latest)
        ]);
        if (!live) return;
        const ledger: LedgerItem[] = [];
        opened.forEach((event: any) => ledger.push({
          block: Number(event.blockNumber), action: "OPEN", side: event.args?.isLong ? "LONG" : "SHORT",
          size: usd6(event.args?.sizeUsd), price: px18(event.args?.entryPrice), tx: String(event.transactionHash)
        }));
        reduced.forEach((event: any) => ledger.push({
          block: Number(event.blockNumber), action: "REDUCE", size: usd6(event.args?.closedSizeUsd),
          price: px18(event.args?.exitPrice), pnl: usd6(event.args?.realizedPnl), tx: String(event.transactionHash)
        }));
        liquidated.forEach((event: any) => ledger.push({
          block: Number(event.blockNumber), action: "LIQUIDATED", price: px18(event.args?.exitPrice),
          pnl: usd6(event.args?.realizedPnl), tx: String(event.transactionHash)
        }));
        ledger.sort((a, b) => b.block - a.block);
        setItems(ledger.slice(0, 30));
        setStatus(ledger.length ? `${ledger.length} ONCHAIN EVENT${ledger.length === 1 ? "" : "S"}` : "NO ONCHAIN TRADES FOR THIS WALLET YET");
      } catch (error) {
        setStatus(error instanceof Error ? `EVENT SYNC ERROR · ${error.message.slice(0, 80)}` : "EVENT SYNC ERROR");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [account]);

  if (!target) return null;

  return createPortal(
    <section className="onchain-ledger">
      <div className="ledger-tabs"><strong>POSITIONS</strong><span>OPEN ORDERS</span><span>TRADE HISTORY</span><span>FUNDING</span><span>LIQUIDATIONS</span><b>{status}</b></div>
      {items.length > 0 && <div className="ledger-table">
        <div className="ledger-head"><span>BLOCK</span><span>ACTION</span><span>SIDE</span><span>SIZE</span><span>PRICE</span><span>PNL</span><span>TX</span></div>
        {items.map((item) => <div className="ledger-entry" key={`${item.tx}-${item.action}`}>
          <span>#{item.block}</span><strong>{item.action}</strong><span className={item.side === "LONG" ? "flow-buy" : item.side === "SHORT" ? "flow-sell" : ""}>{item.side ?? "—"}</span>
          <span>{item.size ?? "—"}</span><span>{item.price ?? "—"}</span><span className={item.pnl?.startsWith("$-") ? "flow-sell" : item.pnl ? "flow-buy" : ""}>{item.pnl ?? "—"}</span>
          <a href={`${HORIZEN_TESTNET.explorer}/tx/${item.tx}`} target="_blank" rel="noreferrer">VIEW ↗</a>
        </div>)}
      </div>}
    </section>,
    target
  );
}
