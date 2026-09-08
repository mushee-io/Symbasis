export const ERC20_ABI = [
  "function faucet()",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)"
];

export const VAULT_ABI = [
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function collateral(address trader) view returns (uint256)",
  "function reservedMargin(address trader) view returns (uint256)",
  "function availableCollateral(address trader) view returns (uint256)"
];

export const ENGINE_ABI = [
  "function positions(address trader,bytes32 marketId) view returns (uint256 sizeUsd,uint256 margin,uint256 entryPrice,uint64 openedAt,uint32 leverageBps,bool isLong)",
  "function openPosition(bytes32 marketId,bool isLong,uint256 margin,uint32 leverageBps,uint256 limitPrice)",
  "function closePosition(bytes32 marketId,uint32 closeBps,uint256 limitPrice)",
  "function getUnrealizedPnl(address trader,bytes32 marketId) view returns (int256)",
  "function getLiquidationPrice(address trader,bytes32 marketId) view returns (uint256)",
  "function isLiquidatable(address trader,bytes32 marketId) view returns (bool)",
  "event PositionOpened(address indexed trader,bytes32 indexed marketId,bool isLong,uint256 sizeUsd,uint256 margin,uint256 entryPrice,uint32 leverageBps)",
  "event PositionReduced(address indexed trader,bytes32 indexed marketId,uint256 closedSizeUsd,uint256 releasedMargin,uint256 exitPrice,int256 realizedPnl,uint256 remainingSizeUsd)",
  "event PositionLiquidated(address indexed trader,bytes32 indexed marketId,address indexed liquidator,uint256 exitPrice,int256 realizedPnl)"
];

export const INTENT_ABI = [
  "function submitIntent(bytes32 commitment) returns (bytes32 intentId)",
  "event IntentSubmitted(address indexed trader,bytes32 indexed intentId,bytes32 commitment)"
];

const temporalNumericValueComponents = [
  { name: "timestampNs", type: "uint64" },
  { name: "quantizedValue", type: "int192" }
];

const updateComponents = [
  { name: "temporalNumericValue", type: "tuple", components: temporalNumericValueComponents },
  { name: "id", type: "bytes32" },
  { name: "publisherMerkleRoot", type: "bytes32" },
  { name: "valueComputeAlgHash", type: "bytes32" },
  { name: "r", type: "bytes32" },
  { name: "s", type: "bytes32" },
  { name: "v", type: "uint8" }
];

export const ORACLE_ABI = [
  {
    type: "function",
    name: "getUpdateFee",
    stateMutability: "view",
    inputs: [{ name: "updateData", type: "tuple[]", components: updateComponents }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "updatePrices",
    stateMutability: "payable",
    inputs: [{ name: "updateData", type: "tuple[]", components: updateComponents }],
    outputs: []
  },
  {
    type: "function",
    name: "latestPrice",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "timestampNs", type: "uint64" }
    ]
  }
];
