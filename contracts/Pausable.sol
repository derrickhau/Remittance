pragma solidity ^0.5.0;

import "./Ownable.sol";

contract Pausable is Ownable {
    bool private isAlive;
    bool private isPaused;

    event LogNewPausedState(bool indexed contractIsPaused, address indexed owner);
    event LogSelfDestruct(address initiatedBy);
    
    modifier whenAlive() {
        require (isAlive, "Contract has been terminated");
        _;
    }

    modifier whenRunning() {
        require (!isPaused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require (isPaused, "Contract is running");
        _;
    }
    
    constructor(bool launchContractPaused) public {
        isAlive = true;
        isPaused = launchContractPaused;
    }

    // Getters
    function getIsAlive() public view returns (bool) { return isAlive; }
    function getIsPaused() public view returns (bool) { return isPaused; }

    // Reversible pause/unpause functions
    function pauseContract() public whenRunning onlyOwner {
        isPaused = true;
        emit LogNewPausedState(isPaused, msg.sender);
    }

    function resumeContract() public whenPaused onlyOwner {
        isPaused = false;
        emit LogNewPausedState(isPaused, msg.sender);
    }
    
    // Irreversible pause function; pause is required to discourage accidental execution
    function kill() public whenPaused onlyOwner {
        emit LogSelfDestruct(msg.sender);
        isAlive = false;
        isPaused = false;
    }
}