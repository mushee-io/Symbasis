// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";

/// @notice Collateral accounting vault for the Symbasis testnet perp engine.
///         Balances are expected to use 6-decimal USDC-style collateral.
contract SymbasisVault {
    IERC20Minimal public immutable collateralToken;
    address public owner;
    address public engine;
    bool public paused;
    uint256 public liquidityBalance;
    uint256 public badDebt;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public reservedMargin;

    uint256 private _locked = 1;

    event EngineUpdated(address indexed engine);
    event PauseUpdated(bool paused);
    event CollateralDeposited(address indexed trader, uint256 amount);
    event CollateralWithdrawn(address indexed trader, uint256 amount);
    event MarginReserved(address indexed trader, uint256 amount);
    event MarginReleased(address indexed trader, uint256 amount);
    event PnlSettled(address indexed trader, int256 pnl, uint256 balanceAfter);
    event LiquiditySeeded(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed recipient, uint256 amount);
    event BadDebtRecorded(address indexed trader, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyEngine() {
        require(msg.sender == engine, "NOT_ENGINE");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address token) {
        require(token != address(0), "ZERO_TOKEN");
        collateralToken = IERC20Minimal(token);
        owner = msg.sender;
    }

    function setEngine(address nextEngine) external onlyOwner {
        require(nextEngine != address(0), "ZERO_ENGINE");
        engine = nextEngine;
        emit EngineUpdated(nextEngine);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "ZERO_ADDRESS");
        owner = nextOwner;
    }

    function availableCollateral(address trader) public view returns (uint256) {
        return collateral[trader] - reservedMargin[trader];
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "ZERO_DEPOSIT");
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAILED");
        collateral[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "ZERO_WITHDRAWAL");
        require(availableCollateral(msg.sender) >= amount, "MARGIN_LOCKED");
        collateral[msg.sender] -= amount;
        require(collateralToken.transfer(msg.sender, amount), "TRANSFER_FAILED");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function seedLiquidity(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "ZERO_LIQUIDITY");
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAILED");
        liquidityBalance += amount;
        emit LiquiditySeeded(msg.sender, amount);
    }

    function withdrawLiquidity(address recipient, uint256 amount) external nonReentrant onlyOwner {
        require(recipient != address(0), "ZERO_ADDRESS");
        require(amount <= liquidityBalance, "INSUFFICIENT_LIQUIDITY");
        liquidityBalance -= amount;
        require(collateralToken.transfer(recipient, amount), "TRANSFER_FAILED");
        emit LiquidityWithdrawn(recipient, amount);
    }

    function reserveMargin(address trader, uint256 amount) external onlyEngine whenNotPaused {
        require(amount > 0, "ZERO_MARGIN");
        require(availableCollateral(trader) >= amount, "INSUFFICIENT_FREE_COLLATERAL");
        reservedMargin[trader] += amount;
        emit MarginReserved(trader, amount);
    }

    function releaseMargin(address trader, uint256 amount) external onlyEngine {
        require(reservedMargin[trader] >= amount, "INSUFFICIENT_RESERVED_MARGIN");
        reservedMargin[trader] -= amount;
        emit MarginReleased(trader, amount);
    }

    /// @dev The engine caps isolated-position losses before calling this function.
    function settlePnl(address trader, int256 pnl) external onlyEngine {
        if (pnl > 0) {
            uint256 profit = uint256(pnl);
            require(liquidityBalance >= profit, "INSUFFICIENT_PROTOCOL_LIQUIDITY");
            liquidityBalance -= profit;
            collateral[trader] += profit;
        } else if (pnl < 0) {
            uint256 requestedLoss = uint256(-pnl);
            uint256 balance = collateral[trader];
            uint256 paid = requestedLoss > balance ? balance : requestedLoss;
            collateral[trader] = balance - paid;
            liquidityBalance += paid;
            if (requestedLoss > paid) {
                uint256 shortfall = requestedLoss - paid;
                badDebt += shortfall;
                emit BadDebtRecorded(trader, shortfall);
            }
        }
        emit PnlSettled(trader, pnl, collateral[trader]);
    }
}
