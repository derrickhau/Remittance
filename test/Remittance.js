const Remittance = artifacts.require("./Remittance.sol");

contract("Remittance", accounts => {
	const [ owner, sender, recipient ] = accounts;

	beforeEach("Deploy fresh, unpaused Remittance", async function () {
		instance = await Remittance.new(0, false, { from: owner });
	});

	// it("Function createKeyHash should successfully create hash ", async function () {
	// 	const twoFA = 123
	// 	const keyHash = await instance.createKeyHash(twoFA, recipient, { from: sender });
	// 	assert.equal(keyHash, keccak256(abi.encodePacked(twoFA, recipient)), "Failed to successfully create hash");
	// });

	it("Should successfully create all elements of struct", async function () {
		const secondsInWeek = 604800;
		const keyHash1 = await instance.createKeyHash (recipient, 123).keyHash1;
		console.log("keyHash1: ", keyHash1);
		// await instance.createRemittance(recipient, secondsInWeek, keyHash1, { from: sender });
	});
});