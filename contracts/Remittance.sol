pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Pausable.sol";

contract Remittance is Pausable {
    using SafeMath for uint;    

    struct Remit {
        address sender;
        address recipient;
        uint amount;
        uint expiration;
        bytes32 keyHash;
    }

    mapping (uint => Remit) remits;
    uint8 constant secondsPerBlock = 15;
    uint remitCounter;
    uint fee;
    uint totalFees;

    event LogCreateRemittance(uint remitID, address indexed sender,
        address recipient, uint amount, uint expiration);
    event LogWithdrawal(uint remitID, address indexed receiver, uint amount);
    event LogSetFee(address setter, uint newFee);
    event LogWithdrawFees(uint remitCounter, uint amountWithdrawn);
    event LogClaimBackExecuted(address sender, address recipient, uint refund);

    constructor (uint initialFee, bool paused) Pausable(paused) public {
        setFee(initialFee);
    }


    function createKeyHash (address recipient) view external{
        bytes32 twoFA = keccak256(abi.encodePacked(block.timestamp, block.difficulty));
        bytes32 keyHash1 = keccak256(abi.encodePacked(twoFA, recipient));
    }

    function createRemittance (address recipient, uint secondsValid, bytes32 keyHash1) public payable notPaused() {
        require(msg.value > fee, "Amount is less than remittance fee");
        uint remitID = remitCounter++;
        uint amount = msg.value.sub(fee);
        totalFees = totalFees.add(fee);
        uint expiration = block.number.add(secondsValid.div(secondsPerBlock));
        bytes32 keyHash2 = keccak256(abi.encodePacked(remitID, keyHash1));
        remits[remitID] = Remit({
            sender: msg.sender,
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
        require(msg.sender == remits[remitID].sender, "Restricted access, sender only");
        require(block.number > remits[remitID].expiration, "Disabled until expiration");
        uint amountDue = remits[remitID].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[remitID].amount = 0;
        emit LogClaimBackExecuted(msg.sender, remits[remitID].recipient, amountDue);
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
        emit LogWithdrawFees(remitCounter, amountDue);
        msg.sender.transfer(amountDue);
    }
}