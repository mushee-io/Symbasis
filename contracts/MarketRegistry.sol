// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TwoStepOwnable} from "./utils/TwoStepOwnable.sol";

contract MarketRegistry is TwoStepOwnable {
    struct Market {
        string symbol;
        bytes32 feedId;
        uint32 maxLeverageBps;
        uint32 maintenanceMarginBps;
        uint256 maxPositionSize;
        uint256 maxOpenInterest;
        bool active;
    }

    mapping(bytes32 => Market) private _markets;
    bytes32[] private _marketIds;

    event MarketAdded(bytes32 indexed marketId, string symbol, bytes32 feedId);
    event MarketRiskUpdated(
        bytes32 indexed marketId,
        uint32 maxLeverageBps,
        uint32 maintenanceMarginBps,
        uint256 maxPositionSize,
        uint256 maxOpenInterest
    );
    event MarketStatusUpdated(bytes32 indexed marketId, bool active);

    function addMarket(
        bytes32 marketId,
        string calldata symbol,
        bytes32 feedId,
        uint32 maxLeverageBps,
        uint32 maintenanceMarginBps,
        uint256 maxPositionSize,
        uint256 maxOpenInterest
    ) external onlyOwner {
        require(marketId != bytes32(0), "ZERO_MARKET_ID");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 32, "BAD_SYMBOL");
        require(feedId != bytes32(0), "ZERO_FEED");
        require(_markets[marketId].feedId == bytes32(0), "MARKET_EXISTS");
        _validateRisk(maxLeverageBps, maintenanceMarginBps, maxPositionSize, maxOpenInterest);

        _markets[marketId] = Market({
            symbol: symbol,
            feedId: feedId,
            maxLeverageBps: maxLeverageBps,
            maintenanceMarginBps: maintenanceMarginBps,
            maxPositionSize: maxPositionSize,
            maxOpenInterest: maxOpenInterest,
            active: true
        });
        _marketIds.push(marketId);
        emit MarketAdded(marketId, symbol, feedId);
    }

    function updateRisk(
        bytes32 marketId,
        uint32 maxLeverageBps,
        uint32 maintenanceMarginBps,
        uint256 maxPositionSize,
        uint256 maxOpenInterest
    ) external onlyOwner {
        Market storage market = _markets[marketId];
        require(market.feedId != bytes32(0), "UNKNOWN_MARKET");
        _validateRisk(maxLeverageBps, maintenanceMarginBps, maxPositionSize, maxOpenInterest);
        market.maxLeverageBps = maxLeverageBps;
        market.maintenanceMarginBps = maintenanceMarginBps;
        market.maxPositionSize = maxPositionSize;
        market.maxOpenInterest = maxOpenInterest;
        emit MarketRiskUpdated(
            marketId,
            maxLeverageBps,
            maintenanceMarginBps,
            maxPositionSize,
            maxOpenInterest
        );
    }

    function setActive(bytes32 marketId, bool active) external onlyOwner {
        require(_markets[marketId].feedId != bytes32(0), "UNKNOWN_MARKET");
        _markets[marketId].active = active;
        emit MarketStatusUpdated(marketId, active);
    }

    function getMarket(bytes32 marketId) external view returns (Market memory) {
        Market memory market = _markets[marketId];
        require(market.feedId != bytes32(0), "UNKNOWN_MARKET");
        return market;
    }

    function getMarketIds() external view returns (bytes32[] memory) {
        return _marketIds;
    }

    function _validateRisk(
        uint32 maxLeverageBps,
        uint32 maintenanceMarginBps,
        uint256 maxPositionSize,
        uint256 maxOpenInterest
    ) internal pure {
        require(maxLeverageBps >= 10_000 && maxLeverageBps <= 200_000, "BAD_LEVERAGE");
        require(maintenanceMarginBps >= 100 && maintenanceMarginBps < 10_000, "BAD_MAINTENANCE");
        require(maxPositionSize > 0, "ZERO_POSITION_LIMIT");
        require(maxOpenInterest >= maxPositionSize, "BAD_OI_LIMIT");
    }
}
