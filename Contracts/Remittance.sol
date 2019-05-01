pragma solidity ^0.5.0;

import "./Pausable.sol";

contract Remittance is Pausable {

    mapping(address => uint) public balances;
    address remittanceAddress;
    bytes32 keyHash;

    event LogRemittanceCreated(address sender, uint amount, address receiver);
    event LogWithdrawal(address indexed receiver, uint amount);
    event LogKillExecuted(address owner, uint refund);
    
    constructor (uint remittanceKey, uint recipientKey, address _remittanceAddress) 
        public payable onlyOwner() {
        require(_remittanceAddress != address(0), "Invalid address");
        remittanceAddress = _remittanceAddress;
        keyHash = keccak256(abi.encodePacked(remittanceKey, recipientKey, _remittanceAddress, msg.value));
        balances[remittanceAddress] = msg.value;
        emit LogRemittanceCreated(msg.sender, msg.value, remittanceAddress);
    }
    
    function withdrawFunds (uint remittanceKey, uint recipientKey) public notPaused() {
        require(keccak256(abi.encodePacked(remittanceKey, recipientKey, msg.sender, balances[msg.sender])) == keyHash, "Access denied"); 
        uint amountDue = balances[msg.sender];
        require(amountDue > 0, "Insufficient funds");
        balances[msg.sender] = 0;
        emit LogWithdrawal(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function kill () public onlyOwner {
        uint refund = balances[remittanceAddress];
        require(refund > 0, "No funds available");
        balances[remittanceAddress] = 0;
        emit LogKillExecuted(msg.sender, refund);
        msg.sender.transfer(refund);
    }
}