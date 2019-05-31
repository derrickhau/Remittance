pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Pausable.sol";

contract Remittance is Pausable {
    using SafeMath for uint;    

    struct Remit {
        address sender;
        uint amount;
        uint expiration;
    }
    
    // keyhash => Remit struct
    mapping (bytes32 => Remit) public remits;
    // Current Owner => FeeAccount struct
    mapping (address => uint) public totalFees;
    
    address owner;
    uint minExpiration; 
    uint maxExpiration;
    uint fee;

    event LogCreateRemittance(address indexed sender, uint amount, uint expiration);
    event LogWithdrawal(address indexed receiver, uint amount);
    event LogCancelRemittance(address indexed sender, uint refund);
    event LogSetFee(address indexed setter, uint newFee);
    event LogSetExpiration(address indexed setter, uint minExp, uint maxExp);
    event LogWithdrawFees(address indexed sender, uint amountWithdrawn);
    
    constructor (uint initialFee, bool paused) Pausable(paused) public {
        setFee(initialFee);
        minExpiration = 15 minutes;
        maxExpiration = 30 days;
    }
    // Generated off-chain
    function createKeyHash (address recipient, uint twoFA) view public returns (bytes32 keyHash){
        require(recipient != address(0), "Valid address required");
        return(keccak256(abi.encodePacked(recipient, twoFA, address(this))));
    }

    function createRemittance (bytes32 keyHash, uint secondsValid) public payable whenRunning isAlive {
        require(msg.value > fee, "Minumum send value not met");
        require(remits[keyHash].sender == address(0), "Duplicate remittance");
        require(secondsValid <= maxExpiration, "Maximum expiration exceeded");
        require(secondsValid >= minExpiration, "Minimum expiration not met");
        uint amount = msg.value.sub(fee);
        totalFees[owner].add(fee);
        uint expiration = now.add(secondsValid);
        remits[keyHash] = Remit({
            sender: msg.sender,
            amount: amount,
            expiration: expiration
        });
        emit LogCreateRemittance(msg.sender, amount, expiration);
    }

    function withdrawFunds(uint twoFA) public whenRunning {
        bytes32 keyHash = createKeyHash(msg.sender, twoFA);
        uint amountDue = remits[keyHash].amount;
        require(amountDue > 0, "Insufficient funds");
        require(now <= remits[keyHash].expiration, "Remittance expired");
        remits[keyHash].amount = 0;
        remits[keyHash].expiration = 0;
        emit LogWithdrawal(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function cancelRemittance(bytes32 keyHash) public whenRunning {
        require(remits[keyHash].sender == msg.sender, "Access restricted to sender");
        require(now > remits[keyHash].expiration, "Disabled until expiration");
        uint amountDue = remits[keyHash].amount;
        require(amountDue > 0, "Insufficient funds");
        remits[keyHash].amount = 0;
        remits[keyHash].expiration = 0;
        emit LogCancelRemittance(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }

    function setFee(uint newFee) public onlyOwner {
        fee = newFee;
        emit LogSetFee(msg.sender, newFee);
    }
    
    function setExpiration(uint min, uint max) public onlyOwner {
        require(min < max, "Maximum must be greater than minimum");
        minExpiration = min;
        maxExpiration = max;
        emit LogSetExpiration(msg.sender, min, max);
    }

    function withdrawFees() public onlyOwner {
        uint _totalFees = totalFees[msg.sender];
        require(_totalFees > 0, "Insufficient funds");
        uint amountDue = totalFees[msg.sender];
        _totalFees = 0;
        emit LogWithdrawFees(msg.sender, amountDue);
        msg.sender.transfer(amountDue);
    }
}