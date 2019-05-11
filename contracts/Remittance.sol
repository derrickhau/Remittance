pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Pausable.sol";

contract Remittance is Pausable {
    using SafeMath for uint;    

    struct Remit {
        address creator;
        address recipient;
        uint amount;
        uint expiration;
        bytes32 keyHash;
    }

    mapping (uint => Remit) remits;
    uint8 secondsPerBlock = 15;
    uint remitCounter;
    uint fee;
    uint totalFees;

    event LogCreateRemittance(uint remitID, address indexed creator,
        address recipient, uint amount, uint expiration);
    event LogWithdrawal(uint remitID, address indexed receiver, uint amount);
    event LogSetFee(uint newFee);
    event LogWithdrawFees(uint remitCounter, uint amountWithdrawn);
    event LogClaimBackExecuted(address creator, address recipient, uint refund);

    constructor (uint initialFee) public {
        setFee(initialFee);
    }

    function createKeyHash (uint twoFA, address recipient) pure external returns (bytes32 keyHash1) {
        keyHash1 = keccak256(abi.encodePacked(twoFA, recipient));
        return keyHash1;
    }

    function createRemittance (address recipient, uint secondsValid, bytes32 keyHash1) public payable notPaused() {
        require(msg.value > fee, "Amount is less than remittance fee");
        uint remitID = remitCounter++;
        uint amount = msg.value.sub(fee);
        totalFees = totalFees.add(fee);
        uint expiration = block.number.add(secondsValid.div(secondsPerBlock));
        bytes32 keyHash2 = keccak256(abi.encodePacked(remitID, keyHash1));
        remits[remitID] = Remit({
            creator: msg.sender,
            recipient: recipient,
            amount: amount,
            expiration: expiration,
            keyHash: keyHash2
        });
        emit LogCreateRemittance(remitID, msg.sender, recipient, amount, expiration);
    }

    function withdrawFunds (uint remitID, uint twoFA) public notPaused() {
        bytes32 keyHash1 = keccak256(abi.encodePacked(twoFA, msg.sender));
        require(keccak256(abi.encodePacked(remitID, keyHash1)) == remits[remitID].keyHash, "Access denied"); 
        require(block.number <= remits[remitID].expiration);
        uint amountDue = remits[remitID].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[remitID].amount = 0;
        emit LogWithdrawal(remitID, msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function claimBack (uint remitID) public notPaused() {
        require(msg.sender == remits[remitID].creator, "Restricted access, creator only");
        require(block.number > remits[remitID].expiration, "Disabled until expiration");
        uint amountDue = remits[remitID].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[remitID].amount = 0;
        emit LogClaimBackExecuted(msg.sender, remits[remitID].recipient, amountDue);
        msg.sender.transfer(amountDue);
    }

    function setFee (uint newFee) public onlyOwner() {
        fee = newFee;
        emit LogSetFee(newFee);
    }

    function withdrawFees () private onlyOwner {
        require(totalFees > 0, "Insufficient funds");
        uint amountDue = totalFees;
        totalFees = 0;
        emit LogWithdrawFees(remitCounter, amountDue);
        msg.sender.transfer(amountDue);
    }
}