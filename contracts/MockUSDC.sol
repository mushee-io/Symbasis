// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Testnet-only USDC-style collateral. This token has an owner mint and a public faucet.
///         Never use this contract as production collateral.
contract MockUSDC {
    string public constant name = "Symbasis Test USDC";
    string public constant symbol = "sUSDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    address public owner;
    uint256 public faucetAmount = 10_000 * 1e6;
    uint256 public faucetCooldown = 1 days;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastFaucetAt;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event FaucetClaimed(address indexed account, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowed - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function faucet() external {
        require(block.timestamp >= lastFaucetAt[msg.sender] + faucetCooldown, "FAUCET_COOLDOWN");
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
        emit FaucetClaimed(msg.sender, faucetAmount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function setFaucet(uint256 amount, uint256 cooldown) external onlyOwner {
        require(amount > 0, "ZERO_AMOUNT");
        require(cooldown >= 1 hours, "COOLDOWN_TOO_SHORT");
        faucetAmount = amount;
        faucetCooldown = cooldown;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "ZERO_ADDRESS");
        owner = nextOwner;
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ZERO_ADDRESS");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ZERO_ADDRESS");
        uint256 balance = balanceOf[from];
        require(balance >= amount, "INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
