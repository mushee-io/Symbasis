// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Stores commitments to private strategy/AI instructions without putting raw strategy data on-chain.
///         An attestor can later attach an execution/result commitment from a confidential coprocessor.
contract ConfidentialIntentRegistry {
    struct Intent {
        address trader;
        bytes32 commitment;
        uint64 createdAt;
        bool executed;
        bytes32 resultHash;
        bytes32 attestationHash;
    }

    address public owner;
    address public attestor;
    bool public paused;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => Intent) public intents;

    event IntentSubmitted(address indexed trader, bytes32 indexed intentId, bytes32 commitment);
    event IntentAttested(bytes32 indexed intentId, bytes32 resultHash, bytes32 attestationHash);
    event AttestorUpdated(address indexed attestor);
    event PauseUpdated(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyAttestor() {
        require(msg.sender == attestor, "NOT_ATTESTOR");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    constructor() {
        owner = msg.sender;
        attestor = msg.sender;
    }

    function submitIntent(bytes32 commitment) external whenNotPaused returns (bytes32 intentId) {
        require(commitment != bytes32(0), "ZERO_COMMITMENT");
        uint256 nonce = nonces[msg.sender]++;
        intentId = keccak256(abi.encodePacked(msg.sender, commitment, nonce, block.chainid));
        require(intents[intentId].trader == address(0), "INTENT_EXISTS");
        intents[intentId] = Intent({
            trader: msg.sender,
            commitment: commitment,
            createdAt: uint64(block.timestamp),
            executed: false,
            resultHash: bytes32(0),
            attestationHash: bytes32(0)
        });
        emit IntentSubmitted(msg.sender, intentId, commitment);
    }

    function recordAttestation(
        bytes32 intentId,
        bytes32 resultHash,
        bytes32 attestationHash
    ) external onlyAttestor whenNotPaused {
        Intent storage intent = intents[intentId];
        require(intent.trader != address(0), "UNKNOWN_INTENT");
        require(!intent.executed, "ALREADY_EXECUTED");
        require(resultHash != bytes32(0) && attestationHash != bytes32(0), "ZERO_ATTESTATION");
        intent.executed = true;
        intent.resultHash = resultHash;
        intent.attestationHash = attestationHash;
        emit IntentAttested(intentId, resultHash, attestationHash);
    }

    function setAttestor(address nextAttestor) external onlyOwner {
        require(nextAttestor != address(0), "ZERO_ADDRESS");
        attestor = nextAttestor;
        emit AttestorUpdated(nextAttestor);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "ZERO_ADDRESS");
        owner = nextOwner;
    }
}
