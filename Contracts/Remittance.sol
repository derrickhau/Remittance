pragma solidity ^0.5.0;

import "./Pausable.sol";

contract Remittance is Pausable {

    mapping(address => uint) public balances;
    address carolAddress;
    bytes32 keyHash;

    event LogWithdrawal(address indexed receiver, uint amount);
    event LogKillExecuted(address owner, uint refund);

    // keyHash generated offchain
    constructor (bytes32 _keyHash, address _carolAddress) public payable {
        carolAddress = _carolAddress;
        keyHash = _keyHash;
        balances[carolAddress] = msg.value;
    }
    
    function withdrawFunds (uint carolKey, uint bobKey) public notPaused() {
        require(keccak256(abi.encodePacked(carolKey, bobKey)) == keyHash, "Access denied"); 
        uint amountDue = balances[msg.sender];
        require(amountDue > 0, "Insufficient funds");
        balances[msg.sender] = 0;
        msg.sender.transfer(amountDue);
        emit LogWithdrawal(msg.sender, amountDue);
    }

    function kill () public onlyOwner {
        uint refund = balances[carolAddress];
        require(refund > 0, "No funds available");
        balances[carolAddress] = 0;
        emit LogKillExecuted(msg.sender, refund);
        msg.sender.transfer(refund);
    }
}