pragma solidity ^0.5.0;

import "./Ownable.sol";

contract Pausable is Ownable {
    bool private contractIsPaused;

    event LogNewPausedState(bool indexed contractIsPaused, address indexed owner);
    event LogSelfDestruct(address initiatedBy);
    
    modifier whenRunning() {
        require (!contractIsPaused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require (contractIsPaused, "Contract is running");
        _;
    }
    
    constructor(bool launchContractPaused) public {
        contractIsPaused = launchContractPaused;
    }

    function isPaused() public view returns (bool) { return contractIsPaused; }

    function contractPaused() public whenRunning onlyOwner {
        contractIsPaused = true;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }
    
    function contractResume() public whenPaused onlyOwner {
        contractIsPaused = false;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }
    
    function kill() public whenPaused onlyOwner {
        emit LogSelfDestruct(msg.sender);
        selfdestruct(msg.sender);
    }
}