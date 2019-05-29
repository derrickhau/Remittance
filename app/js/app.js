const Web3 = require("web3");
const Promise = require("bluebird");
const truffleContract = require("truffle-contract");
const $ = require("jquery");

// Not to forget our built contract
const remittanceJson = require("../../build/contracts/Remittance.json");

// gas max
const GAS = 300000;

// Supports Metamask, and other wallets that provide / inject 'web3'.
if (typeof web3 !== 'undefined') {
    // Use the Mist/wallet/Metamask provider.
    window.web3 = new Web3(web3.currentProvider);
} else {
    // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545')); 
}

// const { sha3 } = window.web3. // Can I use createKeyHash function instead?

const Remittance = truffleContract(remittanceJson);
Remittance.setProvider(window.web3.currentProvider);

window.addEventListener('load', async () => {
    const accounts =  await window.web3.eth.getAccounts();
    console.log("AccountsLength: ", accounts.length); // What is this??
    if (accounts.length == 0) {
        $("#senderBalance").html("N/A");
		$("#status").html("No account with which to transact");
        console.log ("Error: No account with which to transact");
        return; // Is this necessary??
    }
    let ownerAccount = accounts[0];
    let senderAccount = accounts[1];
    let recipientAccount = accounts[2];

    network = await window.web3.eth.net.getId();
    console.log("Network:", network.toString(10));
    let instance; // What is this?? Can it be combined with init below?

    try {
		console.log ("Try to get Remittance instance ...");
		instance = await Remittance.deployed();
    }
    catch(error) {
		$("#status").html("error to access node");
		$("#senderBalance").html("NA");
    	console.log("Error: ", error);
    	return;
    }
    console.log("contract Address: ", instance.address);

    $("#createRemittance").click(async function(){
		console.log ("createRemittance was clicked.");
		await sendFunds();
    }); 

    $("#withdrawFunds").click(async function(){
		console.log ("withdrawFunds was clicked.");
		await withdraw(carolAccount);
    }); 
    
    $("#cancelRemittance").click(async function(){
		console.log ("withdrawFunds was clicked.");
		await claim();
    }); 

    async function createRemittance() {    
		try {
			let recipient = $("input[name='recipient']").val();
			let twoFA = $("input[name='twoFA']").val();
			// let keyHash = await instance.hash(sha3(recipient, twoFA, address(this)));
			// Must be run off-chain; Change to pure? Run here? Hash must match withdrawal
			let keyHash = await instance.createKeyHash(recipient, twoFA);
			let expiration = $("input[name='expiration']").val();
			let amount = $("input[name='amount']").val();

			console.log ("recipient: ", recipient);
			console.log ("keyHash: ", keyHash);
			console.log ("amount: ", amount);			
			console.log ("expiration: ", expiration);

			let txObj = await instance.createRemittance(keyHash, expiration,
			    { from: senderAccount, gas: GAS, value: amount })
			    .on("transactionHash",
			        txHash => $("#status").html("Remittance sent " + txHash))

			const receipt = txObj.receipt;
			console.log("got receipt", receipt);
			if (!receipt.status) {
				console.error("Wrong status");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, status not 1");
			} else if (receipt.logs.length == 0) {
				console.error("Empty logs");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, missing expected event");
			} else {
				console.log(receipt.logs[0]);
				$("#status").html("Transfer executed");
			}
		}

       catch(error) {
			$("#status").html("transaction error");
			console.log ("Error:",error);
		}
    };

    async function withdrawFunds(address) {
       try {
			let twoFA = $("input[name='twoFA']").val();
			console.log ("twoFA: ", twoFA);

			let txObj = await instance.withdrawFunds(twoFA, { from: address, gas: GAS })
                .on("transactionHash",
				txHash => $("#status").html("Transaction on the way " + txHash))

			const receipt = txObj.receipt;
			console.log("got receipt", receipt);
			if (!receipt.status) {
				console.error("Wrong status");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, status not 1");
			} else if (receipt.logs.length == 0) {
				console.error("Empty logs");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, missing expected event");
			} else {
				console.log(receipt.logs[0]);
				$("#status").html("Transfer executed");
			}
		}
       
		catch(error) {
			$("#status").html("transaction error");
			console.log ("Error:",error);
		}
    };

    async function cancelRemittance() {
       try {
           let keyHash = $("input[name='keyHash']").val();
       
			console.log ("keyHash: ", keyHash);
			// let completeHash = await instance.hash(sha3(bobSecret), carolAccount);
			// console.log('completeHash:',completeHash);
			let txObj = await instance.claim(keyHash, { from: senderAccount, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

			const receipt = txObj.receipt;
			console.log("got receipt", receipt);
			if (!receipt.status) {
				console.error("Wrong status");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, status not 1");
			} else if (receipt.logs.length == 0) {
				console.error("Empty logs");
				console.error(receipt);
				$("#status").html("There was an error in the tx execution, missing expected event");
			} else {
				console.log(receipt.logs[0]);
				$("#status").html("Transfer executed");
			}
		}
		catch(error) {
			$("#status").html("transaction error");
			console.log ("Error:",error);
		}
    };
});

require("file-loader?name=../index.html!../index.html");