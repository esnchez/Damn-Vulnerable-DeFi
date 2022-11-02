# Damn Vulnerable DeFi

**A set of challenges to learn offensive security of smart contracts in Ethereum.**

Featuring flash loans, price oracles, governance, NFTs, lending pools, smart contract wallets, timelocks, and more!

## Play

Visit [damnvulnerabledefi.xyz](https://damnvulnerabledefi.xyz)

## Run solutions
All .js test files contain a detailed explanation of the exploit needed in every case, as well as a step-by-step approach following the code. 
Also, some malicious contracts had to be elaborated and deployed in tests files to complete the hack. They are all placed in attacker-contracts folder.  

1. Install
```
git clone https://github.com/esnchez/Damn-Vulnerable-DeFi.git
yarn install
```
2. Run tests (scripts are running yarn hardhat test from behind)
```
yarn run {challenge-name}
```

## Disclaimer

All Solidity code, practices and patterns in this repository are DAMN VULNERABLE and for educational purposes only.

DO NOT USE IN PRODUCTION.
