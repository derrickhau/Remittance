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
		await instance.createRemittance(keyHashTest, secondsInWeek, { from: sender, value: amountSent });
		const remitStruct = await instance.remits(keyHashTest, { from: sender });
		console.log("remitStruct: ", remitStruct);
		assert.equal(remitStruct.sender, sender, "Failed to successfully match sender");
		assert.equal(remitStruct.amount, amountSent, "Failed to successfully match amount");
		assert.equal(remitStruct.expiration, secondsInWeek + block.timestamp, "Failed to successfully match expiration");
	});
});