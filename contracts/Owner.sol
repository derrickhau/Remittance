pragma solidity ^0.5.0;

contract Owner {
    address private owner;
    
    event LogTransferOwnership (address previousOwner, address newOwner);

    modifier onlyOwner() {
        require (msg.sender == owner, "Restricted access, owner only");
        _;
    }
    
    constructor () public {
        owner = msg.sender;
    }
    
    function getOwner() public view returns (address) { return owner; }
    
    function transferOwnership (address newOwner) internal onlyOwner {
        emit LogTransferOwnership (owner, newOwner);
        owner = newOwner;
    }
}