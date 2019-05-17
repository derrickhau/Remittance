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
    // keyhash => Remit struct
    mapping (bytes32 => Remit) remits;
    uint fee;
    uint totalFees;

    event LogCreateRemittance(address indexed sender, uint amount, uint expiration);
    event LogWithdrawal(address indexed receiver, uint amount);
    event LogSetFee(address indexed setter, uint newFee);
    event LogCancelRemittance(address indexed sender, uint refund);
    event LogWithdrawFees(address indexed sender, uint amountWithdrawn);

    constructor (uint initialFee, bool paused) Pausable(paused) public {
        setFee(initialFee);
    }
    // Generated off-chain
    function createKeyHash (address recipient, uint twoFA) view external returns (bytes32 keyHash){
        return(keccak256(abi.encodePacked(recipient, twoFA, address(this))));
    }

    function createRemittance (bytes32 keyHash, uint secondsValid) public payable isRunning() {
        uint maxExpiration = 2592000; // 30 days
        uint minExpiration = 900; // 15 minutes
        require(msg.value > fee, "Minumum send value not met");
        require(remits[keyHash].sender != msg.sender, "Duplicate twoFA");
        require(secondsValid < maxExpiration, "Maximum expiration exceeded");
        require(secondsValid > minExpiration, "Minimum expiration not met");
        uint amount = msg.value.sub(fee);
        totalFees = totalFees.add(fee);
        uint expiration = now.add(secondsValid);
        remits[keyHash] = Remit({
            sender: msg.sender,
            amount: amount,
            expiration: expiration,
            keyHash: keyHash
        });
        emit LogCreateRemittance(msg.sender, amount, expiration);
    }

    function withdrawFunds (uint twoFA) public isRunning() {
        bytes32 keyHash = keccak256(abi.encodePacked(msg.sender, twoFA, address(this)));
        require(msg.sender == remits[keyHash].sender, "Access denied"); 
        require(block.number <= remits[keyHash].expiration);
        uint amountDue = remits[keyHash].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[keyHash].amount = 0;
        emit LogWithdrawal(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function cancelRemittance (bytes32 keyHash) public isRunning() {
        require(block.number > remits[keyHash].expiration, "Disabled until expiration");
        uint amountDue = remits[keyHash].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[keyHash].amount = 0;
        emit LogCancelRemittance(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function setFee (uint newFee) public onlyOwner() {
        fee = newFee;
        emit LogSetFee(msg.sender, newFee);
    }

    function withdrawFees () public onlyOwner {
        require(totalFees > 0, "Insufficient funds");
        uint amountDue = totalFees;
        totalFees = 0;
        emit LogWithdrawFees(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }
}