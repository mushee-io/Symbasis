type BrandProps = {
  light?: boolean;
  compact?: boolean;
};

export function SymbasisMark({ light = false }: { light?: boolean }) {
  const fg = light ? "#f2f2f0" : "#171715";
  const bg = light ? "#090909" : "#f2f1ed";
  return (
    <svg viewBox="0 0 180 100" aria-hidden="true" className="sym-logo-mark">
      <path d="M18 84A72 72 0 0 1 162 84H18Z" fill={fg} />
      <g fill={bg} opacity=".96">
        <circle cx="64" cy="22" r="2.1"/><circle cx="72" cy="18" r="1.8"/><circle cx="80" cy="20" r="1.2"/><circle cx="90" cy="14" r="1.8"/><circle cx="98" cy="18" r="1.4"/><circle cx="107" cy="22" r="2.1"/><circle cx="116" cy="25" r="1.4"/><circle cx="126" cy="31" r="2.2"/><circle cx="137" cy="39" r="1.6"/><circle cx="145" cy="48" r="2.3"/>
        <circle cx="73" cy="26" r="1.1"/><circle cx="83" cy="24" r="2.4"/><circle cx="93" cy="25" r="1.6"/><circle cx="103" cy="28" r="1.1"/><circle cx="112" cy="31" r="2"/><circle cx="121" cy="36" r="1.3"/><circle cx="131" cy="42" r="2.6"/><circle cx="140" cy="53" r="1.6"/><circle cx="149" cy="61" r="2.4"/><circle cx="154" cy="70" r="1.7"/>
        <circle cx="92" cy="31" r="1.3"/><circle cx="102" cy="35" r="2.3"/><circle cx="113" cy="39" r="1.5"/><circle cx="122" cy="45" r="2.2"/><circle cx="132" cy="51" r="1.2"/><circle cx="140" cy="60" r="2.5"/><circle cx="148" cy="68" r="1.5"/><circle cx="153" cy="77" r="2"/>
        <circle cx="121" cy="52" r="1.4"/><circle cx="130" cy="58" r="2"/><circle cx="138" cy="66" r="1.4"/><circle cx="145" cy="73" r="2.2"/><circle cx="151" cy="81" r="1.5"/>
      </g>
      <g fill={bg} opacity=".55">
        <circle cx="58" cy="30" r=".9"/><circle cx="67" cy="34" r="1"/><circle cx="77" cy="30" r=".8"/><circle cx="88" cy="36" r=".9"/><circle cx="98" cy="40" r=".8"/><circle cx="108" cy="43" r="1"/><circle cx="118" cy="48" r=".9"/><circle cx="128" cy="55" r="1"/><circle cx="136" cy="63" r=".8"/><circle cx="144" cy="72" r="1"/>
      </g>
    </svg>
  );
}

export default function SymbasisBrand({ light = false, compact = false }: BrandProps) {
  return (
    <span className={`sym-brand ${compact ? "is-compact" : ""}`}>
      <SymbasisMark light={light} />
      <span className="sym-wordmark">SYMBASIS</span>
    </span>
  );
}
