const Remittance = artifacts.require("./Remittance.sol");
web3.eth.advanceTime = require("../utils/advanceTime.js");
web3.eth.advanceBlock = require("../utils/advanceBlock.js");

contract("Remittance", accounts => {
	const [ owner, sender, recipient ] = accounts;

	beforeEach("Deploy fresh, unpaused Remittance", async function () {
		instance = await Remittance.new(0, false, { from: owner });
	});

	it("Should successfully create all elements of struct", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const remitStruct = await instance.remits(keyHashTest, { from: sender });

		const blockObj = await web3.eth.getBlock('latest');
		const timestamp = blockObj.timestamp;
		const timePlusExp = timestamp + secondsInWeek;

		assert.strictEqual(remitStruct.sender, sender, "Failed to successfully match sender");
		assert.strictEqual(remitStruct.amount.toString(), amountSent.toString(), "Failed to successfully match amount");
		assert.strictEqual(remitStruct.expiration.toString(), timePlusExp.toString(), "Failed to successfully match expiration");
	});

	it("Should prevent amount sent below minimum allowed", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const lowAmountSent = 0; // amount must be higher than fee
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: lowAmountSent })
			.then( () => Promise.reject(new Error('Minumum send value not met')),
			err => assert.instanceOf(err, Error), "Failed to prevent amount sent below minimum allowed");
	});

	it("Should prevent entry when appropriate with duplicate twoFA", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;		
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const keyHashTestDuplicate = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTestDuplicate, secondsInWeek, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Duplicate twoFA')),
			err => assert.instanceOf(err, Error), "Failed to prevent duplicate twoFA");
	});

	it("Should prevent expiration above maximum", async function () {
		const twoFA = 123;
		const maxExp = 2678400; // 31 days, max allowed is 30 days
		const amountSent = 10000;
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTest, maxExp, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Maximum expiration exceeded')),
			err => assert.instanceOf(err, Error), "Failed to prevent expiration above maximum");
	});

	it("Should prevent expiration below minimum", async function () {
		const twoFA = 123;
		const minExp = 600; // 10 minutes, min allowed is 15 minutes
		const amountSent = 10000;
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTest, minExp, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Minimum expiration not met')),
			err => assert.instanceOf(err, Error), "Failed to prevent expiration below minimum");
	});

	it("Should log createRemittance correctly", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		const txObject = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });

		const blockObj = await web3.eth.getBlock('latest');
		const timestamp = blockObj.timestamp;
		const timePlusExp = timestamp + secondsInWeek;

		assert.strictEqual(txObject.logs[0].args.sender, sender, 
			"Failed to log withdrawal recipient correctly");
		assert.strictEqual(txObject.logs[0].args.amount.toString(), amountSent.toString(), 
			"Failed to log withdrawal amount correctly");
		assert.strictEqual(txObject.logs[0].args.expiration.toString(), timePlusExp.toString(), 
			"Failed to log withdrawal expiration correctly");
	});

	it("Should log withdrawal correctly", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		
		assert.strictEqual(txObject.logs[0].args.receiver.toString(), recipient.toString(), 
			"Failed to log withdrawal recipient correctly");
		assert.strictEqual(txObject.logs[0].args.amount.toString(), amountSent.toString(), 
			"Failed to log withdrawal amount correctly");
	});

	it("Should correctly calculate gas cost and withdrawal amount", async function () {
		const BN = web3.utils.BN;
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		

		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = (await web3.eth.getTransactionReceipt(txObject.tx)).gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		
		const postMinusWithdrawalAmountBN = new BN(postBalanceBN).sub(new BN(amountSent));
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual(preBalanceBN.sub(postMinusWithdrawalAmountBN).toString(), totalGasCostBN.toString(),
			"Failed to accurately calculate gas cost of withdrawal");
		assert.strictEqual(txObject.logs[0].args.amount.toString(), amountSent.toString(),
			"Failed to log withdrawal amount correctly");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Failed to withdraw correct amount");
	});

	it("Should cancel remittance, withdraw funds by sender, prevent withdrawal by recipient", async function () {
		const BN = web3.utils.BN;
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Adjust time to allow remittance to expire
		let blockObj = await web3.eth.getBlock('latest');
		let currentBlock = blockObj.number;
		let timestamp = blockObj.timestamp;
		console.log("currentBlock: ", currentBlock);
		console.log("timestamp: ", timestamp);

	    await web3.eth.advanceTime(secondsInWeek + 1);
	    await web3.eth.advanceBlock();
       		    
		blockObj = await web3.eth.getBlock('latest');
		currentBlock = blockObj.number;
		timestamp = blockObj.timestamp;
		console.log("currentBlock: ", currentBlock);
		console.log("timestamp: ", timestamp);

		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(sender));
		console.log("1");
		const txObject = await instance.cancelRemittance(keyHashTest, { from: sender });
		console.log("2");
		const postBalanceBN = new BN(await web3.eth.getBalance(sender));		
		console.log("3");
		
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = (await web3.eth.getTransactionReceipt(txObject.tx)).gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		
		const postMinusRefundBN = new BN(postBalanceBN).sub(new BN(amountSent));		
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		console.log("preMinusPostMinusRefund: ", preBalanceBN.sub(postMinusRefundBN.toString()));
		console.log("totalGasCostBN: ", totalGasCostBN.toString());

		console.log("logRefund: ", txObject.logs[0].args.refund.toString());
		console.log("amountSent: ", amountSent.toString());

		console.log("preMinusPostMinusRefund: ", (postPlusGasBN.sub(preBalanceBN)).toString());
		console.log("amountSent: ", amountSent.toString());

		assert.strictEqual(preBalanceBN.sub(postMinusRefundBN).toString(), totalGasCostBN.toString(),
			"Failed to accurately calculate gas cost of cancelRemittance");
		assert.strictEqual(txObject.logs[0].args.refund.toString(), amountSent.toString(),
			"Failed to log cancelRemittance amount correctly");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Failed to refund correct amount");
	});

	it("Should prevent withdrawal from wrong recipient and paused contract", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		return instance.withdrawFunds(twoFA, { from: sender })
			.then( () => Promise.reject(new Error('Remittance expired')),
			err => assert.instanceOf(err, Error), "Failed to prevent withdrawal from wrong recipient");

		await instance.contractPaused( { from: owner } );
		return instance.withdrawFunds(twoFA, { from: recipient })
			.then( () => Promise.reject(new Error('Contract is paused')),
			err => assert.instanceOf(err, Error), "Paused state failed to prevent withdrawal");
	});

	it("Should allow withdrawal contract and prevent createRemittance after kill initiated", async function () {
		const BN = web3.utils.BN;
		const twoFA = 123;
		const twoFA2 = 456;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		await instance.killRemittanceContract( { from: owner } );

		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		
		
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = (await web3.eth.getTransactionReceipt(txObject.tx)).gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));

		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Kill failed to allow successful withdrawal of correct amount");
		
		// Attempt createRemittance with different twoFA
		const keyHashTest2 = await instance.createKeyHash(recipient, twoFA2);
		return instance.createRemittance(keyHashTest2, secondsInWeek, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Contract has been terminated')),
			err => assert.instanceOf(err, Error), "Kill failed to prevent createRemittance");
	});

	it("Should successfully transfer ownership, set new fees, and withdraw fees correctly", async function () {
		// All three are combined because the default fees are zero
		// Transfer ownership to recipient because owner is coinbase and interfering with calculation
		const BN = web3.utils.BN;
		const newFee = 1;
		const twoFA = 123;
		const twoFA2 = 456;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		await instance.transferOwnership(recipient, { from: owner } );
		await instance.setFee(newFee, { from: recipient } );
		
		// Remittance 1
		const keyHashTest = await instance.createKeyHash(owner, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });	
		
		// Remittance 2
		const keyHashTest2 = await instance.createKeyHash(owner, twoFA2);
		await instance.createRemittance(keyHashTest2, secondsInWeek, { from: sender, value: amountSent });
		
		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));

		const txObject = await instance.withdrawFees( { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		

		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = (await web3.eth.getTransactionReceipt(txObject.tx)).gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));

		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), (newFee * 2).toString(),
			"Failed to successfully withdraw fees correctly");
	});
});