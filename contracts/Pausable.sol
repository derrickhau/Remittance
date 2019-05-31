pragma solidity ^0.5.0;

import "./Ownable.sol";

contract Pausable is Ownable {
    bool private alive;
    bool private contractIsPaused;

    event LogNewPausedState(bool indexed contractIsPaused, address indexed owner);
    event LogSelfDestruct(address initiatedBy);
    
    modifier isAlive() {
        require (alive, "Contract has been terminated");
        _;
    }

    modifier whenRunning() {
        require (!contractIsPaused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require (contractIsPaused, "Contract is running");
        _;
    }
    
    constructor(bool launchContractPaused) public {
        alive = true;
        contractIsPaused = launchContractPaused;
    }

    // Paused state getter function
    function isPaused() public view returns (bool) { return contractIsPaused; }

    // Reversible pause/unpause functions
    function contractPaused() public whenRunning onlyOwner {
        contractIsPaused = true;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }

    function contractResume() public whenPaused onlyOwner {
        contractIsPaused = false;
        emit LogNewPausedState(contractIsPaused, msg.sender);
    }
    
    // Irreversible pause function; pause is required to discourage accidental execution
    function kill() public whenPaused onlyOwner {
        emit LogSelfDestruct(msg.sender);
        alive = false;
        contractIsPaused = false;
    }
}