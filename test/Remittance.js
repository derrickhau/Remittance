const Remittance = artifacts.require("./Remittance.sol");
const { advanceTimeAndMine } = require("./helpers/advanceTimeAndMine.js");

contract("Remittance", accounts => {
	const [ owner, sender, recipient ] = accounts;

	beforeEach("Deploy fresh, unpaused Remittance", async function () {
		instance = await Remittance.new(0, false, { from: owner });
	});

	it("Should successfully advance time/block", async function () {
		// Timestamp1
		const currentBlock1 = await web3.eth.getBlockNumber();
		const currentTimestamp1 = (await web3.eth.getBlock(currentBlock1)).timestamp;
		console.log("currentBlock1: ", currentBlock1);
		console.log("currentTimestamp1: ", currentTimestamp1);

		// Advance time and block:
		await advanceTimeAndMine(100);

		// Timestamp2
	    const currentBlock2 = await web3.eth.getBlockNumber();
		const currentTimestamp2 = (await web3.eth.getBlock(currentBlock2)).timestamp;
		console.log("currentBlock2: ", currentBlock2);
		console.log("currentTimestamp2: ", currentTimestamp2);
	});

	it("Should successfully create all elements of struct", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		const txObj = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const remitStruct = await instance.remits(keyHashTest);
	
		// Get current block/timestamp
		const timestamp = (await web3.eth.getBlock(txObj.receipt.blockNumber)).timestamp;
		const timePlusExp = timestamp + secondsInWeek;

		assert.strictEqual(remitStruct.sender, sender, "Failed to successfully match sender");
		assert.strictEqual(remitStruct.amount.toString(), amountSent.toString(), "Failed to successfully match amount");
		assert.strictEqual(remitStruct.expiration.toString(), timePlusExp.toString(), "Failed to successfully match expiration");
	});

	it("Should prevent amount sent below minimum allowed", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const lowAmountSent = 0; // amount must be higher than fee
		
		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: lowAmountSent })
			.then( () => Promise.reject(new Error('Minumum send value not met')),
			err => assert.instanceOf(err, Error), "Failed to prevent amount sent below minimum allowed");
	});

	it("Should prevent expiration above maximum", async function () {
		const twoFA = 123;
		const maxExp = 2678400; // 31 days, max allowed is 30 days
		const amountSent = 10000;

		// Create remittance		
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTest, maxExp, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Maximum expiration exceeded')),
			err => assert.instanceOf(err, Error), "Failed to prevent expiration above maximum");
	});

	it("Should prevent expiration below minimum", async function () {
		const twoFA = 123;
		const minExp = 600; // 10 minutes, min allowed is 15 minutes
		const amountSent = 10000;
		
		// Create remittance		
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return instance.createRemittance(keyHashTest, minExp, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Minimum expiration not met')),
			err => assert.instanceOf(err, Error), "Failed to prevent expiration below minimum");
	});

	it("Should log createRemittance correctly", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		const txObject = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Get current block/timestamp
		const timestamp = (await web3.eth.getBlock(txObject.receipt.blockNumber)).timestamp;
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
		
		// Create remittance		
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

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Calculate withdrawal
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		

		// Calculate gas costs
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = txObject.receipt.gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		
		// Calculate gas cost via transaction accounting
		const postMinusWithdrawalAmountBN = new BN(postBalanceBN).sub(new BN(amountSent));
		
		// Calculate amount sent via transaction accounting
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual(preBalanceBN.sub(postMinusWithdrawalAmountBN).toString(), totalGasCostBN.toString(),
			"Failed to accurately calculate gas cost of withdrawal");
		assert.strictEqual(txObject.logs[0].args.amount.toString(), amountSent.toString(),
			"Failed to log withdrawal amount correctly");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Failed to withdraw correct amount");
	});

	// // ***FAILS in Geth - Can't advance time/block***
	it("Should cancel remittance, withdraw funds by sender, prevent withdrawal by recipient", async function () {
		const BN = web3.utils.BN;
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		// Create Remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		const createTxObj = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Timestamp1
		const timestamp1 = (await web3.eth.getBlock(createTxObj.receipt.blockNumber)).timestamp;
		const currentBlock1 = await web3.eth.getBlockNumber();

		// Advance time and block: 
		await advanceTimeAndMine(100);

		// Cancel Remittance
		const preBalanceBN = new BN(await web3.eth.getBalance(sender));
		const cancelTxObj = await instance.cancelRemittance(keyHashTest, { from: sender });
		const postBalanceBN = new BN(await web3.eth.getBalance(sender));		

	    // Timestamp2
		const timestamp2 = (await web3.eth.getBlock(cancelTxObj.receipt.blockNumber)).timestamp;
		const currentBlock2 = await web3.eth.getBlockNumber();

		// Calculate gas cost from transaction receipt
		const gasPrice = (await web3.eth.getTransaction(cancelTxObj.tx)).gasPrice;
		const gasUsed = cancelTxObj.receipt.gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		
		// Calculate gas cost via transaction accounting
		const postMinusRefundBN = new BN(postBalanceBN).sub(new BN(amountSent));		

		// Calculate amount sent via transaction accounting
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual(preBalanceBN.sub(postMinusRefundBN).toString(), totalGasCostBN.toString(),
			"Failed to accurately calculate gas cost of cancelRemittance");
		assert.strictEqual(cancelTxObj.logs[0].args.refund.toString(), amountSent.toString(),
			"Failed to log cancelRemittance amount correctly");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Failed to refund correct amount");
	});

	it("Should prevent withdrawal by wrong recipient and paused contract", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;
		
		// Sender creates remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Sender attempts withdrawal (Recipient is onlu user authorized to withdraw)
		return instance.withdrawFunds(twoFA, { from: sender })
			.then( () => Promise.reject(new Error('Insufficient funds')),
			err => assert.instanceOf(err, Error), "Failed to prevent withdrawal from wrong recipient");

		// Pause and attempt withdrawal
		await instance.contractPaused({ from: owner });
		return instance.withdrawFunds(twoFA, { from: recipient })
			.then( () => Promise.reject(new Error('Contract is paused')),
			err => assert.instanceOf(err, Error), "Paused state failed to prevent withdrawal");
	});

	it("Should allow withdrawal and prevent createRemittance after kill initiated", async function () {
		const BN = web3.utils.BN;
		const twoFA = 123;
		const twoFA2 = 456;
		const secondsInWeek = 604800;
		const amountSent = 10000;

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });

		// Kill contract (pause state required)
		await instance.pauseContract({ from: owner });
		await instance.kill({ from: owner });

		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		
		
		// Calculate gas costs
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = txObject.receipt.gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));

		// Calculate amount sent via transaction accounting
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Kill failed to allow successful withdrawal of correct amount");
		
		// Attempt createRemittance with different twoFA
		const keyHashTest2 = await instance.createKeyHash(recipient, twoFA2);
		return await instance.createRemittance(keyHashTest2, secondsInWeek, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Contract has been terminated')),
			err => assert.instanceOf(err, Error), "Kill failed to prevent createRemittance");
	});

	it("Should successfully: 1) transfer ownership, 2) set new fees, and 3) calculate withdrawal fees correctly", async function () {
		// Since the default fees are set to zero, these three test are complementary
		// Transfer ownership to recipient because owner is coinbase and interfering with calculation
		const BN = web3.utils.BN;
		const newFee = 1;
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 1000000;

		// 1) Transfer ownership
		await instance.nominateNewOwner(recipient, { from: owner });
		const ownershipTxObj = await instance.claimOwnership({ from: recipient });

		// 2) Set new fees
		const feeTxObj = await instance.setFee(newFee, { from: recipient });
		
		// Remittance 1
		const keyHashTest = await instance.createKeyHash(owner, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });	
		
		// 3) Calculate withdrawal fees correctly
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const withdrawTxObject = await instance.withdrawFees({ from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		

		// Calculate gas costs
		const gasPrice = (await web3.eth.getTransaction(withdrawTxObject.tx)).gasPrice;
		const gasUsed = withdrawTxObject.receipt.gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));

		// Calculate amount sent via transaction accounting
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual(ownershipTxObj.logs[0].args.newOwner, recipient, "Failed to successfully transfer ownership to recipient");
		assert.strictEqual(feeTxObj.logs[0].args.newFee.toString(), newFee.toString(), "Failed to successfully set new fee");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), newFee.toString(),
			"Failed to successfully withdraw fees correctly");
	});

	it("Should prevent entry with duplicate keyHash from same sender", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;		

		// Create remittance
		const keyHash = await instance.createKeyHash(recipient, twoFA);		
		await instance.createRemittance(keyHash, secondsInWeek, { from: sender, value: amountSent });

		// Attempt duplicate use of keyHash
		return await instance.createRemittance(keyHash, secondsInWeek, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Duplicate twoFA')),
			err => assert.instanceOf(err, Error), "Failed to prevent duplicate twoFA");
	});

	it("Should prevent overwriting remittance", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent1 = 10000;
		const amountSent2 = 10;

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent1 });
		
		// Attempt to overwrite remittance
		return await instance.createRemittance(keyHashTest, secondsInWeek, { from: owner, value: amountSent2 })
			.then( () => Promise.reject(new Error('Duplicate remittance')),
			err => assert.instanceOf(err, Error), "Failed to prevent overwriting remittance");
	});
});