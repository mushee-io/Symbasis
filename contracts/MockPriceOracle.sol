// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    struct PriceData {
        uint256 price;
        uint64 timestampNs;
    }

    mapping(bytes32 => PriceData) public prices;

    function setPrice(bytes32 feedId, uint256 price) external {
        require(price > 0, "ZERO_PRICE");
        prices[feedId] = PriceData({
            price: price,
            timestampNs: uint64(block.timestamp * 1e9)
        });
    }

    function latestPrice(bytes32 feedId) external view override returns (uint256 price, uint64 timestampNs) {
        PriceData memory data = prices[feedId];
        require(data.price > 0, "NO_PRICE");
        return (data.price, data.timestampNs);
    }
}
