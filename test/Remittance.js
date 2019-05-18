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
});