// Method 1 FAIL
// https://github.com/bruzzopa/Remittance/blob/master/test/remittance.test.js
module.exports = function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      const newBlockHash = web3.eth.getBlock('latest').hash
      return resolve(newBlockHash)
    })
  })
}