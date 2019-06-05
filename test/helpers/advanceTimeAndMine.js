// // Method 5 FAIL: https://github.com/RoyalMist/Remittance/blob/master/test/remittance_spec.js#L9

const evmMethod = (method, params = []) => {
    return new Promise(function (resolve, reject) {
        const sendMethod = (web3.currentProvider.sendAsync) ? web3.currentProvider.sendAsync.bind(web3.currentProvider) : web3.currentProvider.send.bind(web3.currentProvider);
        sendMethod(
            {
                jsonrpc: '2.0',
                method,
                params,
                id: new Date().getSeconds()
            },
            (error, res) => {
                if (error) {
                    return reject(error);
                }
                resolve(res.result);
            }
        );
    });
};

const advanceTimeAndMine = async (amount) => {
    await evmMethod("evm_increaseTime", [Number(amount)]);
    await evmMethod("evm_mine");
};

module.exports = { advanceTimeAndMine };