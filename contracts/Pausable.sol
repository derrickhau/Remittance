pragma solidity ^0.5.0;

import "./Ownable.sol";

contract Pausable is Ownable {
    bool internal contractIsPaused;

    event LogNewPausedState(bool indexed contractIsPaused, address indexed owner);
    event LogSelfDestruct(address initiatedBy);
    
    modifier isRunning() {
        require (!contractIsPaused, "Contract is paused");
        _;
    }
    
    modifier isPaused() {
        require (contractIsPaused, "Contract is running");
        _;
    }
    
    constructor(bool launchContractPaused) public {
        contractIsPaused = launchContractPaused;
    }

    function getPausedState() public view returns (bool) { return contractIsPaused; }

    function contractPaused() public isRunning onlyOwner {
        contractIsPaused = true;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }
    
    function contractResume() public isPaused onlyOwner {
        contractIsPaused = false;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }
    
    function kill() public isPaused onlyOwner {
        emit LogSelfDestruct(msg.sender);
        selfdestruct(msg.sender);
    }
}