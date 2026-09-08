// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SymbasisVault {
    address public immutable owner;
    mapping(address => uint256) public collateral;

    event CollateralDeposited(address indexed trader, uint256 amount);
    event CollateralWithdrawn(address indexed trader, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        require(msg.value > 0, "ZERO_DEPOSIT");
        collateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "ZERO_WITHDRAWAL");
        uint256 balance = collateral[msg.sender];
        require(balance >= amount, "INSUFFICIENT_COLLATERAL");

        unchecked {
            collateral[msg.sender] = balance - amount;
        }

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
        emit CollateralWithdrawn(msg.sender, amount);
    }
}
