// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStork} from "./interfaces/IStork.sol";

contract MockStork is IStork {
    mapping(bytes32 => TemporalNumericValue) public values;
    uint256 public fee = 1 wei;

    function setValue(bytes32 id, int192 price, uint64 timestampNs) external {
        values[id] = TemporalNumericValue({timestampNs: timestampNs, quantizedValue: price});
    }

    function setFee(uint256 nextFee) external {
        fee = nextFee;
    }

    function updateTemporalNumericValuesV1(
        TemporalNumericValueInput[] calldata updateData
    ) external payable override {
        require(msg.value >= fee, "MOCK_FEE");
        for (uint256 i = 0; i < updateData.length; i++) {
            values[updateData[i].id] = updateData[i].temporalNumericValue;
        }
    }

    function getUpdateFeeV1(
        TemporalNumericValueInput[] calldata
    ) external view override returns (uint256 feeAmount) {
        return fee;
    }

    function getTemporalNumericValueV1(
        bytes32 id
    ) external view override returns (TemporalNumericValue memory value) {
        return values[id];
    }
}
