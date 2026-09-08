// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SymbasisVault} from "./SymbasisVault.sol";
import {MarketRegistry} from "./MarketRegistry.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {TwoStepOwnable} from "./utils/TwoStepOwnable.sol";

/// @notice Testnet perpetual engine using isolated margin and 6-decimal USD notional accounting.
///         Oracle prices use 18 decimals.
contract PerpEngine is TwoStepOwnable {
    uint256 private constant BPS = 10_000;
    uint256 private constant DAY = 1 days;

    struct Position {
        uint256 sizeUsd;
        uint256 margin;
        uint256 entryPrice;
        uint64 openedAt;
        uint32 leverageBps;
        bool isLong;
    }

    SymbasisVault public immutable vault;
    MarketRegistry public immutable markets;
    IPriceOracle public immutable oracle;

    bool public paused;

    mapping(address => mapping(bytes32 => Position)) public positions;
    mapping(bytes32 => uint256) public openInterestLong;
    mapping(bytes32 => uint256) public openInterestShort;
    mapping(bytes32 => int32) public fundingRateBpsPerDay;

    event PauseUpdated(bool paused);
    event FundingRateUpdated(bytes32 indexed marketId, int32 rateBpsPerDay);
    event PositionOpened(
        address indexed trader,
        bytes32 indexed marketId,
        bool isLong,
        uint256 sizeUsd,
        uint256 margin,
        uint256 entryPrice,
        uint32 leverageBps
    );
    event PositionReduced(
        address indexed trader,
        bytes32 indexed marketId,
        uint256 closedSizeUsd,
        uint256 releasedMargin,
        uint256 exitPrice,
        int256 realizedPnl,
        uint256 remainingSizeUsd
    );
    event PositionLiquidated(
        address indexed trader,
        bytes32 indexed marketId,
        address indexed liquidator,
        uint256 exitPrice,
        int256 realizedPnl
    );

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    constructor(address vaultAddress, address marketRegistry, address priceOracle) {
        require(vaultAddress != address(0), "ZERO_VAULT");
        require(marketRegistry != address(0), "ZERO_MARKETS");
        require(priceOracle != address(0), "ZERO_ORACLE");
        vault = SymbasisVault(vaultAddress);
        markets = MarketRegistry(marketRegistry);
        oracle = IPriceOracle(priceOracle);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    function setFundingRate(bytes32 marketId, int32 rateBpsPerDay) external onlyOwner {
        require(rateBpsPerDay >= -1_000 && rateBpsPerDay <= 1_000, "FUNDING_OUT_OF_RANGE");
        markets.getMarket(marketId);
        fundingRateBpsPerDay[marketId] = rateBpsPerDay;
        emit FundingRateUpdated(marketId, rateBpsPerDay);
    }

    function openPosition(
        bytes32 marketId,
        bool isLong,
        uint256 margin,
        uint32 leverageBps,
        uint256 limitPrice
    ) external whenNotPaused {
        require(margin > 0, "ZERO_MARGIN");
        require(limitPrice > 0, "ZERO_LIMIT_PRICE");
        require(positions[msg.sender][marketId].sizeUsd == 0, "POSITION_EXISTS");

        MarketRegistry.Market memory market = markets.getMarket(marketId);
        require(market.active, "MARKET_INACTIVE");
        require(leverageBps >= BPS && leverageBps <= market.maxLeverageBps, "BAD_LEVERAGE");

        uint256 sizeUsd = (margin * leverageBps) / BPS;
        require(sizeUsd > 0 && sizeUsd <= market.maxPositionSize, "POSITION_LIMIT");

        (uint256 price, ) = oracle.latestPrice(market.feedId);
        if (isLong) {
            require(price <= limitPrice, "LONG_SLIPPAGE");
            require(openInterestLong[marketId] + sizeUsd <= market.maxOpenInterest, "LONG_OI_LIMIT");
            openInterestLong[marketId] += sizeUsd;
        } else {
            require(price >= limitPrice, "SHORT_SLIPPAGE");
            require(openInterestShort[marketId] + sizeUsd <= market.maxOpenInterest, "SHORT_OI_LIMIT");
            openInterestShort[marketId] += sizeUsd;
        }

        vault.reserveMargin(msg.sender, margin);
        positions[msg.sender][marketId] = Position({
            sizeUsd: sizeUsd,
            margin: margin,
            entryPrice: price,
            openedAt: uint64(block.timestamp),
            leverageBps: leverageBps,
            isLong: isLong
        });

        emit PositionOpened(msg.sender, marketId, isLong, sizeUsd, margin, price, leverageBps);
    }

    /// @notice Closing remains available during emergency pause so users can reduce risk.
    /// @param closeBps 1..10000, where 10000 closes the full position.
    /// @param limitPrice For a long close, minimum acceptable price. For a short close, maximum acceptable price.
    function closePosition(bytes32 marketId, uint32 closeBps, uint256 limitPrice) external {
        require(closeBps > 0 && closeBps <= BPS, "BAD_CLOSE_BPS");
        require(limitPrice > 0, "ZERO_LIMIT_PRICE");
        _close(msg.sender, marketId, closeBps, limitPrice);
    }

    /// @notice Liquidation remains available during emergency pause to protect solvency.
    function liquidate(address trader, bytes32 marketId) external {
        require(isLiquidatable(trader, marketId), "NOT_LIQUIDATABLE");
        Position memory p = positions[trader][marketId];
        MarketRegistry.Market memory market = markets.getMarket(marketId);
        (uint256 price, ) = oracle.latestPrice(market.feedId);
        int256 pnl = _positionPnl(p, p.sizeUsd, p.margin, price, marketId);

        _decreaseOpenInterest(marketId, p.isLong, p.sizeUsd);
        delete positions[trader][marketId];
        vault.releaseMargin(trader, p.margin);
        vault.settlePnl(trader, pnl);

        emit PositionLiquidated(trader, marketId, msg.sender, price, pnl);
    }

    function getUnrealizedPnl(address trader, bytes32 marketId) public view returns (int256) {
        Position memory p = positions[trader][marketId];
        require(p.sizeUsd > 0, "NO_POSITION");
        MarketRegistry.Market memory market = markets.getMarket(marketId);
        (uint256 price, ) = oracle.latestPrice(market.feedId);
        return _positionPnl(p, p.sizeUsd, p.margin, price, marketId);
    }

    function getPositionEquity(address trader, bytes32 marketId) external view returns (int256 equity) {
        Position memory p = positions[trader][marketId];
        require(p.sizeUsd > 0, "NO_POSITION");
        return int256(p.margin) + getUnrealizedPnl(trader, marketId);
    }

    function getLiquidationPrice(address trader, bytes32 marketId) external view returns (uint256) {
        Position memory p = positions[trader][marketId];
        require(p.sizeUsd > 0, "NO_POSITION");
        MarketRegistry.Market memory market = markets.getMarket(marketId);

        uint256 maintenance = (p.sizeUsd * market.maintenanceMarginBps) / BPS;
        require(p.margin > maintenance, "INVALID_MARGIN_STATE");
        uint256 lossBudget = p.margin - maintenance;
        uint256 move = (lossBudget * p.entryPrice) / p.sizeUsd;

        if (p.isLong) {
            return move >= p.entryPrice ? 0 : p.entryPrice - move;
        }
        return p.entryPrice + move;
    }

    function isLiquidatable(address trader, bytes32 marketId) public view returns (bool) {
        Position memory p = positions[trader][marketId];
        if (p.sizeUsd == 0) return false;
        MarketRegistry.Market memory market = markets.getMarket(marketId);
        int256 pnl = getUnrealizedPnl(trader, marketId);
        int256 equity = int256(p.margin) + pnl;
        uint256 maintenance = (p.sizeUsd * market.maintenanceMarginBps) / BPS;
        return equity <= int256(maintenance);
    }

    function _close(address trader, bytes32 marketId, uint32 closeBps, uint256 limitPrice) internal {
        Position storage stored = positions[trader][marketId];
        require(stored.sizeUsd > 0, "NO_POSITION");
        MarketRegistry.Market memory market = markets.getMarket(marketId);
        (uint256 price, ) = oracle.latestPrice(market.feedId);

        if (stored.isLong) {
            require(price >= limitPrice, "LONG_CLOSE_SLIPPAGE");
        } else {
            require(price <= limitPrice, "SHORT_CLOSE_SLIPPAGE");
        }

        Position memory p = stored;
        uint256 closeSize = closeBps == BPS ? p.sizeUsd : (p.sizeUsd * closeBps) / BPS;
        uint256 closeMargin = closeBps == BPS ? p.margin : (p.margin * closeBps) / BPS;
        require(closeSize > 0 && closeMargin > 0, "CLOSE_TOO_SMALL");

        int256 pnl = _positionPnl(p, closeSize, closeMargin, price, marketId);
        _decreaseOpenInterest(marketId, p.isLong, closeSize);

        vault.releaseMargin(trader, closeMargin);
        vault.settlePnl(trader, pnl);

        if (closeBps == BPS) {
            delete positions[trader][marketId];
        } else {
            stored.sizeUsd = p.sizeUsd - closeSize;
            stored.margin = p.margin - closeMargin;
        }

        emit PositionReduced(
            trader,
            marketId,
            closeSize,
            closeMargin,
            price,
            pnl,
            closeBps == BPS ? 0 : p.sizeUsd - closeSize
        );
    }

    function _decreaseOpenInterest(bytes32 marketId, bool isLong, uint256 sizeUsd) internal {
        if (isLong) {
            openInterestLong[marketId] -= sizeUsd;
        } else {
            openInterestShort[marketId] -= sizeUsd;
        }
    }

    function _positionPnl(
        Position memory p,
        uint256 sizeUsd,
        uint256 marginForSlice,
        uint256 currentPrice,
        bytes32 marketId
    ) internal view returns (int256) {
        int256 pricePnl;
        if (p.isLong) {
            pricePnl = (int256(currentPrice) - int256(p.entryPrice)) * int256(sizeUsd) / int256(p.entryPrice);
        } else {
            pricePnl = (int256(p.entryPrice) - int256(currentPrice)) * int256(sizeUsd) / int256(p.entryPrice);
        }

        int256 rate = int256(fundingRateBpsPerDay[marketId]);
        uint256 elapsed = block.timestamp - uint256(p.openedAt);
        int256 fundingPayment = int256(sizeUsd) * rate * int256(elapsed) / int256(BPS * DAY);
        int256 pnl = p.isLong ? pricePnl - fundingPayment : pricePnl + fundingPayment;

        int256 maxLoss = -int256(marginForSlice);
        if (pnl < maxLoss) return maxLoss;
        return pnl;
    }
}
