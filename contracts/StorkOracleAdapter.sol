// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IStork} from "./interfaces/IStork.sol";
import {TwoStepOwnable} from "./utils/TwoStepOwnable.sol";

/// @notice Horizen/Stork pull-oracle adapter. Prices are 18-decimal USD values.
contract StorkOracleAdapter is IPriceOracle, TwoStepOwnable {
    IStork public immutable stork;
    uint256 public maxAge = 120 seconds;
    uint256 private _locked = 1;

    event MaxAgeUpdated(uint256 maxAge);
    event PricesUpdated(address indexed updater, uint256 updates, uint256 feePaid);

    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address storkAddress) {
        require(storkAddress != address(0), "ZERO_STORK");
        stork = IStork(storkAddress);
    }

    function setMaxAge(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 5 seconds && seconds_ <= 15 minutes, "BAD_MAX_AGE");
        maxAge = seconds_;
        emit MaxAgeUpdated(seconds_);
    }

    function getUpdateFee(
        IStork.TemporalNumericValueInput[] calldata updateData
    ) external view returns (uint256) {
        require(updateData.length > 0, "NO_UPDATES");
        return stork.getUpdateFeeV1(updateData);
    }

    function updatePrices(
        IStork.TemporalNumericValueInput[] calldata updateData
    ) external payable nonReentrant {
        require(updateData.length > 0 && updateData.length <= 16, "BAD_UPDATE_COUNT");
        uint256 fee = stork.getUpdateFeeV1(updateData);
        require(msg.value >= fee, "INSUFFICIENT_UPDATE_FEE");
        stork.updateTemporalNumericValuesV1{value: fee}(updateData);

        uint256 refund = msg.value - fee;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "REFUND_FAILED");
        }
        emit PricesUpdated(msg.sender, updateData.length, fee);
    }

    function latestPrice(bytes32 feedId) external view override returns (uint256 price, uint64 timestampNs) {
        require(feedId != bytes32(0), "ZERO_FEED");
        IStork.TemporalNumericValue memory value = stork.getTemporalNumericValueV1(feedId);
        require(value.quantizedValue > 0, "INVALID_PRICE");
        require(value.timestampNs > 0, "MISSING_TIMESTAMP");

        uint256 timestampSeconds = uint256(value.timestampNs) / 1e9;
        require(timestampSeconds <= block.timestamp + 5 seconds, "FUTURE_PRICE");
        require(block.timestamp <= timestampSeconds + maxAge, "STALE_PRICE");

        return (uint256(uint192(value.quantizedValue)), value.timestampNs);
    }
}
