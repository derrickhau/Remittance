pragma solidity ^0.5.0;

contract Ownable {
    address private owner;
    address private newOwner;

    event LogNominateNewOwner (address indexed previousOwner, address indexed newOwner);
    event LogClaimOwnership (address indexed previousOwner, address indexed newOwner);
    event LogRenounceOwnership (address indexed owner);

    modifier onlyOwner() {
        require (msg.sender == owner, "Restricted access, owner only");
        _;
    }
    
    constructor () public {
        owner = msg.sender;
    }
    // Getters
    function getOwner() public view returns (address) { return owner; }
    function getNewOwner() public view returns (address) { return newOwner; }

    function nominateNewOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit LogNominateNewOwner (owner, _newOwner);
        newOwner = _newOwner;
    }
    
    function claimOwnership() public {
        require(msg.sender != address(0), "Invalid address");
        require(msg.sender == newOwner, "Access denied");
        emit LogClaimOwnership (owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
    
    function renounceOwnership() public onlyOwner {
        emit LogRenounceOwnership(owner);
        owner = address(0);
    }
}