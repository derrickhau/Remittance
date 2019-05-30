const Remittance = artifacts.require("./Remittance.sol");
const expectedExceptionPromise = require("./helpers/expected_exception_testRPC_and_geth.js");

// Consolidate utils and helper folders once a working method is found
// Method 1 FAIL
// https://github.com/bruzzopa/Remittance/blob/master/test/remittance.test.js
// web3.eth.advanceTime = require("../utils/advanceTime.js");
// web3.eth.advanceBlock = require("../utils/advanceBlock.js");

// Method 2a FAIL
// https://github.com/feamcor/blockstars_eth_remittance/blob/master/test/remittance.js
// const truffleHelper = require("./helpers/truffleTestHelper");
// const { advanceTime } = truffleHelper;
// const { advanceBlock } = truffleHelper;
// Method 2b FAIL
// const { advanceTimeAndBlock } = truffleHelper;

// Method 3 FAIL addEvmFxns(web3) in contract initialization
// const addEvmFxns = require("../utils/evm.js");

// Method 4 FAIL https://medium.com/fluidity/standing-the-time-of-test-b906fcc374a9
// const AdvTimeAndBlock = require("../utils/AdvTimeAndBlock.js");

// Method 5 FAIL
// https://github.com/RoyalMist/Remittance/blob/master/test/remittance_spec.js#L9
// const evmMethod = (method, params = []) => {
//     return new Promise(function (resolve, reject) {
//         const sendMethod = (web3.currentProvider.sendAsync) ? web3.currentProvider.sendAsync.bind(web3.currentProvider) : web3.currentProvider.send.bind(web3.currentProvider);
//         sendMethod(
//             {
//                 jsonrpc: '2.0',
//                 method,
//                 params,
//                 id: new Date().getSeconds()
//             },
//             (error, res) => {
//                 if (error) {
//                     return reject(error);
//                 }

//                 resolve(res.result);
//             }
//         );
//     });
// };

// Method 5 FAIL
// https://github.com/RoyalMist/Remittance/blob/master/test/remittance_spec.js#L9
// const increaseTime = async (amount) => {
//     await evmMethod("evm_increaseTime", [Number(amount)]);
//     await evmMethod("evm_mine");
// };

contract("Remittance", accounts => {
    // addEvmFxns(web3);
	const [ owner, sender, recipient ] = accounts;

	beforeEach("Deploy fresh, unpaused Remittance", async function () {
		instance = await Remittance.new(0, false, { from: owner });
	});

	it("Should successfully create all elements of struct", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		
		const txObj = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const remitStruct = await instance.remits(keyHashTest, { from: sender });
	
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
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		return await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: lowAmountSent })
			.then( () => Promise.reject(new Error('Minumum send value not met')),
			err => assert.instanceOf(err, Error), "Failed to prevent amount sent below minimum allowed");
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
		
		// Calculate ammount sent
		const postMinusWithdrawalAmountBN = new BN(postBalanceBN).sub(new BN(amountSent));
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual(preBalanceBN.sub(postMinusWithdrawalAmountBN).toString(), totalGasCostBN.toString(),
			"Failed to accurately calculate gas cost of withdrawal");
		assert.strictEqual(txObject.logs[0].args.amount.toString(), amountSent.toString(),
			"Failed to log withdrawal amount correctly");
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Failed to withdraw correct amount");
	});

	// FAIL Can't advance time/block
	// it("Should cancel remittance, withdraw funds by sender, prevent withdrawal by recipient", async function () {
	// 	const BN = web3.utils.BN;
	// 	const twoFA = 123;
	// 	const secondsInWeek = 604800;
	// 	const amountSent = 10000;

	// 	// Create Remittance
	// 	const keyHashTest = await instance.createKeyHash(recipient, twoFA);
	// 	const txObj = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
	// 	// Timestamp1
	// 	const timestamp1 = (await web3.eth.getBlock(txObj.receipt.blockNumber)).timestamp;	// 	const timePlusExp = timestamp + secondsInWeek;
	// 	const currentBlock1 = await web3.eth.getBlockNumber();
	// 	console.log("currentBlock1: ", currentBlock1);
	// 	console.log("timestamp1: ", timestamp1);

		// Advance time and block: 
		// Method 1 FAIL
		// await web3.eth.advanceTime(secondsInWeek + 1);
		// await web3.eth.advanceBlock();

		// Method 2a FAIL 
		// https://github.com/feamcor/blockstars_eth_remittance/blob/master/test/remittance.js
		// await advanceTime(secondsInWeek + 1);
		// await advanceBlock();
		// Method 2b 
		// await advanceTimeAndBlock (secondsInWeek + 1);

		// Method 3 FAIL
		// addEvmFxns(web3).increaseTime(secondsInWeek + 1);
		// await web3.evm.mine();

		// Method 4 FAIL https://medium.com/fluidity/standing-the-time-of-test-b906fcc374a9
		// await AdvTimeAndBlock.advanceTimeAndBlock(secondsInWeek + 1);

		// Method 5 FAIL https://github.com/RoyalMist/Remittance/blob/master/test/remittance_spec.js#L9
		// await increaseTime(secondsInWeek + 1);

		// Method 6 FAIL
		// const increaseTime = addSeconds => {web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [addSeconds], id: 0 }) };
		// increaseTime(secondsInWeek + 1);
		// await web3.currentProvider.sendAsync({
		// 	jsonrpc: "2.0",
		// 	method: "evm_mine",
		// 	id: 12345
		// }, function(err, result) {
	 //    	if (err) { return reject(err) }
	 //    	const newBlockHash = web3.eth.getBlock('latest').hash
	 //    	return resolve(newBlockHash)
		// });

	//     // Timestamp2
	// 	const timestamp2 = (await web3.eth.getBlock(txObj.receipt.blockNumber)).timestamp;	// 	const timePlusExp = timestamp + secondsInWeek;
	// 	const currentBlock2 = await web3.eth.getBlockNumber();
	// 	console.log("currentBlock2: ", currentBlock2);
	// 	console.log("timestamp3: ", timestamp2);

	// 	// Cancel Remittance
	// 	const preBalanceBN = new BN(await web3.eth.getBalance(sender));
	// 	console.log("1");
	// 	const txObject = await instance.cancelRemittance(keyHashTest, { from: sender });
	// 	console.log("2");
	// 	const postBalanceBN = new BN(await web3.eth.getBalance(sender));		
	// 	console.log("3");

	// 	// Calculate gas costs		
	// 	const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
	// 	const gasUsed = txObject.receipt.gasUsed;
	// 	const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		
	// 	const postMinusRefundBN = new BN(postBalanceBN).sub(new BN(amountSent));		
	// 	const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

	// 	console.log("preMinusPostMinusRefund: ", preBalanceBN.sub(postMinusRefundBN.toString()));
	// 	console.log("totalGasCostBN: ", totalGasCostBN.toString());

	// 	console.log("logRefund: ", txObject.logs[0].args.refund.toString());
	// 	console.log("amountSent: ", amountSent.toString());

	// 	console.log("preMinusPostMinusRefund: ", (postPlusGasBN.sub(preBalanceBN)).toString());
	// 	console.log("amountSent: ", amountSent.toString());

	// 	assert.strictEqual(preBalanceBN.sub(postMinusRefundBN).toString(), totalGasCostBN.toString(),
	// 		"Failed to accurately calculate gas cost of cancelRemittance");
	// 	assert.strictEqual(txObject.logs[0].args.refund.toString(), amountSent.toString(),
	// 		"Failed to log cancelRemittance amount correctly");
	// 	assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
	// 		"Failed to refund correct amount");
	// });

	it("Should prevent withdrawal from wrong recipient and paused contract", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;
		
		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		// Withdraw funds
		return instance.withdrawFunds(twoFA, { from: sender })
			.then( () => Promise.reject(new Error('Remittance expired')),
			err => assert.instanceOf(err, Error), "Failed to prevent withdrawal from wrong recipient");

		// Pause and attempt withdrawal
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

		// Create remittance
		const keyHashTest = await instance.createKeyHash(recipient, twoFA);
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		
		await instance.killRemittanceContract( { from: owner } );

		// Calculate withdrawal including gas costs
		const preBalanceBN = new BN(await web3.eth.getBalance(recipient));
		const txObject = await instance.withdrawFunds(twoFA, { from: recipient });
		const postBalanceBN = new BN(await web3.eth.getBalance(recipient));		
		
		// Calculate gas costs
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = txObject.receipt.gasUsed;

		// Calculate amount sent
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));

		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), amountSent.toString(),
			"Kill failed to allow successful withdrawal of correct amount");
		
		// Attempt createRemittance with different twoFA
		const keyHashTest2 = await instance.createKeyHash(recipient, twoFA2);
		return await instance.createRemittance(keyHashTest2, secondsInWeek, { from: sender, value: amountSent })
			.then( () => Promise.reject(new Error('Contract has been terminated')),
			err => assert.instanceOf(err, Error), "Kill failed to prevent createRemittance");
	});

	it("Should successfully: 1) transfer ownership, 2) set new fees, and 3) withdraw fees correctly", async function () {
		// Since the default fees are set to zero, these three test are complementary
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

	// 	// Calculate gas costs
		const gasPrice = (await web3.eth.getTransaction(txObject.tx)).gasPrice;
		const gasUsed = txObject.receipt.gasUsed;
		const totalGasCostBN = new BN(gasPrice).mul(new BN(gasUsed));

		// Calculate fees
		const postPlusGasBN = new BN(postBalanceBN.add(totalGasCostBN));
		assert.strictEqual((postPlusGasBN.sub(preBalanceBN)).toString(), (newFee * 2).toString(),
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

	// Method 1 PASS
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

	// Method 2 FAIL
	// http://gist.github.com/xavierlepretre/d5583222fde52ddfbc58b7cfa0d2d0a9
    // Error: Invalid number of parameters for "undefined". Got 1 expected 2!

	// it("Should prevent overwriting remittance", async function () {
	// 	const twoFA = 123;
	// 	const secondsInWeek = 604800;
	// 	const amountSent1 = 10000;
	// 	const amountSent2 = 10;

	// 	// Create remittance
	// 	const keyHashTest = await instance.createKeyHash(recipient, twoFA);
	// 	await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent1 });

	// 	return Remittance.new({ from: owner })
	// 		.then(function (newRemittance) {
	// 			return extensions.expectedExceptionPromise(function () {
	// 				return newRemittance.createRemittance("Duplicate remittance", 
	// 					{ from: sender, value: amountSent1 });
	// 				}, keyHashTest, secondsInWeek);
	// 		})
	// });
});
