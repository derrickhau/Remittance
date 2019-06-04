web3.eth.filter("pending").watch(function() {
    if (eth.mining) return;
    console.log(new Date() + "-- Transactions detected, so starting mining.");
    miner.start(1);
});

web3.eth.filter('latest', function(error, result) {
    console.log(new Date() + "-- Got latest, so stopping mining");
    miner.stop();
    if (txpool.status.pending > 0) {
        console.log(new Date() + "-- There were in fact pending transactions, so starting mining.");
        miner.start(1);
    }
});

if (txpool.status.pending) {
    console.log(new Date() + "-- Pending transactions on startup, so starting mining.");
    miner.start(1);
}

console.log(new Date() + "-- Started on-demand mining. Watching txpool for pending Txs..");

web3.eth.getBlockNumber(function(error, result) {
    if (result.toString(10) == "0") {
        console.log(new Date() + "-- empty chain. Mining first block");
        miner.start(1);
    }
});