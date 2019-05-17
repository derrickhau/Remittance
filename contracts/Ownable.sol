pragma solidity ^0.5.0;

contract Ownable {
    address private owner;
    
    event LogTransferOwnership (address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require (msg.sender == owner, "Restricted access, owner only");
        _;
    }
    
    constructor () public {
        owner = msg.sender;
    }
    
    function getOwner() public view returns (address) { return owner; }
    
    function transferOwnership (address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit LogTransferOwnership (owner, newOwner);
        owner = newOwner;
    }
}