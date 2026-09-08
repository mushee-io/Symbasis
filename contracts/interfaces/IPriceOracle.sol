// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPriceOracle {
    /// @return price 18-decimal USD price
    /// @return timestampNs oracle timestamp in nanoseconds
    function latestPrice(bytes32 feedId) external view returns (uint256 price, uint64 timestampNs);
}
