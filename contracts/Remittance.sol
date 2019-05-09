pragma solidity ^0.5.0;

import "./Pausable.sol";

contract Remittance is Pausable {

    bytes32 public keyHash;
    uint blockExpiration;

    event LogWithdrawal(address indexed receiver, uint amount);
    event LogKillExecuted(address owner, uint refund);

    // keyHash generated offchain
    constructor (bytes32 _keyHash, uint secondsValid) public payable {
        keyHash = _keyHash;
        blockExpiration = block.number + (secondsValid / 15);
    }
    
    function withdrawFunds (uint carolKey, uint bobKey) public notPaused() {
        require(keccak256(abi.encodePacked(carolKey, bobKey, msg.sender)) == keyHash, "Access denied"); 
        require(block.number < blockExpiration);
        emit LogWithdrawal(msg.sender, address(this).balance);
        msg.sender.transfer(address(this).balance);
    }

    function kill () public onlyOwner {
        require(block.number > blockExpiration);
        msg.sender.transfer(address(this).balance);
        emit LogKillExecuted(msg.sender, address(this).balance);
    }
}