exports.getReplicasIncrease = function (messageNumber) {
    //Define your complex scaling logic here
    if (messageNumber > 5) {
        return 1;
    } else {
        return -1;
    }
}