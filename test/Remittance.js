const Remittance = artifacts.require("./Remittance.sol");

contract("Remittance", accounts => {
	const [ owner, sender, recipient ] = accounts;

	beforeEach("Deploy fresh, unpaused Remittance", async function () {
		instance = await Remittance.new(0, false, { from: owner });
	});

	it("Should successfully create all elements of struct", async function () {
		const twoFA = 123;
		const secondsInWeek = 604800;
		const amountSent = 10000;
		await instance.createKeyHash(recipient, twoFA)
			.then(keyHash => keyHashTest = keyHash);
		console.log("keyHashTest: ", keyHashTest);
		// await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent })
			// .then(console.log("Remit.call(keyHashTest): ", Remit.call(keyHashTest)));
		const remitStruct = await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent })
			.methods.Remit(keyHashTest);

			// .then(remits => { console.log("remits[keyHashTest]: ", remits[keyHashTest]) });
		console.log("remitStruct.sender: ", remitStruct.sender);

		// await instance.createKeyHash(recipient, twoFA)
			// .then(await instance.createRemittance(keyHash, secondsInWeek, { from: sender, value: amountSent }))
			// .then(assert.equal(remit[keyHash].sender, msg.sender, "Failed to successfully match sender"));
		// assert.equal(remitStruct.amount, amountSent, "Failed to successfully match amount");
		// assert.equal(remitStruct.expiration, , "Failed to successfully match expiration");
		// assert.equal(remitStruct.keyHash, keccak256(abi.encodePacked(keyHash, address(this))), "Failed to successfully match keyHash");
	});
});