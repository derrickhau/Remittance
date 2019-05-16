pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Pausable.sol";

contract Remittance is Pausable {
    using SafeMath for uint;    

    struct Remit {
        address sender;
        uint amount;
        uint expiration;
        bytes32 keyHash;
    }

    mapping (bytes32 => Remit) remits;
    uint8 constant secondsPerBlock = 15;
    uint fee;
    uint totalFees;

    event LogCreateRemittance(address indexed sender,
        address recipient, uint amount, uint expiration);
    event LogWithdrawal(address indexed receiver, uint amount);
    event LogSetFee(address setter, uint newFee);
    event LogClaimBackExecuted(address sender, uint refund);
    event LogWithdrawFees(address sender, uint amountWithdrawn);

    constructor (uint initialFee, bool paused) Pausable(paused) public {
        setFee(initialFee);
    }
    // Generated off-chain
    function createKeyHash (address recipient, uint twoFA) pure external {
        bytes32 keyHash1 = keccak256(abi.encodePacked(recipient, twoFA));
    }

    function createRemittance (address recipient, bytes32 keyHash1, uint secondsValid) public payable notPaused() {
        require(msg.value > fee, "Amount is less than remittance fee");
        require(remits[keyHash1].sender != msg.sender, "Duplicate twoFA");
        uint amount = msg.value.sub(fee);
        totalFees = totalFees.add(fee);
        uint expiration = block.number.add(secondsValid.div(secondsPerBlock));
        bytes32 keyHash2 = keccak256(abi.encodePacked(keyHash1, address(this)));
        remits[keyHash1] = Remit({
            sender: msg.sender,
            amount: amount,
            expiration: expiration,
            keyHash: keyHash2
        });
        emit LogCreateRemittance(msg.sender, recipient, amount, expiration);
    }

    function withdrawFunds (uint twoFA) public notPaused() {
        bytes32 keyHash1 = keccak256(abi.encodePacked(msg.sender, twoFA));
        require(keccak256(abi.encodePacked(keyHash1, address(this))) == remits[keyHash1].keyHash, "Access denied"); 
        require(block.number <= remits[keyHash1].expiration);
        uint amountDue = remits[keyHash1].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[keyHash1].amount = 0;
        emit LogWithdrawal(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function claimBack (bytes32 keyHash1) public notPaused() {
        require(block.number > remits[keyHash1].expiration, "Disabled until expiration");
        uint amountDue = remits[keyHash1].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[keyHash1].amount = 0;
        emit LogClaimBackExecuted(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function setFee (uint newFee) public onlyOwner() {
        fee = newFee;
        emit LogSetFee(msg.sender, newFee);
    }

    function withdrawFees () private onlyOwner {
        require(totalFees > 0, "Insufficient funds");
        uint amountDue = totalFees;
        totalFees = 0;
        emit LogWithdrawFees(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }
}