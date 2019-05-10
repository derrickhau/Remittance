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
    uint remitCounter;
    uint fee;
    
    event LogCreateRemittance(uint remitID, address indexed creator, address recipient, uint amount, uint expiration);
    event LogWithdrawal(uint remitID, address indexed receiver, uint amount);
    event LogSetFee(uint newFee);
    event LogKillExecuted(address owner, uint refund);

    // keyHash generated offchain
    constructor () public {}
    
    function createRemittance (address recipient, uint secondsValid, bytes32 keyHash) public payable {
        require(msg.value > fee, "Amount is less than remittance fee");
        uint remitID = remitCounter++;
        uint amount = msg.value.sub(fee);
        uint expiration = block.number.add((secondsValid.div(15)));
        remits[remitID] = Remit(msg.sender, recipient, amount, expiration, keyHash);
        emit LogCreateRemittance(remitID, msg.sender, recipient, amount, expiration);
    }
    
    function withdrawFunds (uint remitID, uint twoFA) public notPaused() {
        require(keccak256(abi.encodePacked(twoFA, msg.sender)) == remits[remitID].keyHash, "Access denied"); 
        require(block.number < remits[remitID].expiration);
        uint amountDue = remits[remitID].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[remitID].amount = 0;
        emit LogWithdrawal(remitID, msg.sender, remits[remitID].amount);
        msg.sender.transfer(remits[remitID].amount);
    }

    function setFee (uint newFee) public onlyOwner() {
        fee = newFee;
        emit LogSetFee(newFee);
    }
    
    function withdrawFees () private onlyOwner {
        msg.sender.transfer(address(this).balance);
    }
    
    function kill (uint remitID) public {
        require(msg.sender == remits[remitID].sender, "Restricted access, creator only");
        require(block.number > remits[remitID].expiration, "Kill disabled until expiration");
        msg.sender.transfer(address(this).balance);
        emit LogKillExecuted(msg.sender, remits[remitID].amount);
    }
}