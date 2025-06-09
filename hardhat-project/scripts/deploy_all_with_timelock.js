const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const platformWalletAddress = deployer.address;
    const initialPlatformFeePercentage = 5;
    const timelockMinDelaySeconds = 60;

    // 1. Deploy ContentCreation
    const ContentCreation = await ethers.getContractFactory("ContentCreation");
    const contentCreation = await ContentCreation.deploy();
    await contentCreation.waitForDeployment();
    console.log("ContentCreation deployed to:", contentCreation.target);

    // 2. Deploy IPRightsManager
    const IPRightsManager = await ethers.getContractFactory("IPRightsManager");
    const ipRightsManager = await IPRightsManager.deploy(deployer.address);
    await ipRightsManager.waitForDeployment();
    console.log("IPRightsManager deployed to:", ipRightsManager.target);

    // 3. Deploy PeripheralSales
    const PeripheralSales = await ethers.getContractFactory("PeripheralSales");
    const peripheralSales = await PeripheralSales.deploy(deployer.address, ipRightsManager.target);
    await peripheralSales.waitForDeployment();
    console.log("PeripheralSales deployed to:", peripheralSales.target);

    // 4. Deploy ValueSharing
    const ValueSharing = await ethers.getContractFactory("ValueSharing");
    const valueSharing = await ValueSharing.deploy(deployer.address, platformWalletAddress, initialPlatformFeePercentage);
    await valueSharing.waitForDeployment();
    console.log("ValueSharing deployed to:", valueSharing.target);

    // 5. Deploy TimelockController
    const TimelockController = await ethers.getContractFactory("TimelockController"); // Reverted to simple name
    const proposers = [deployer.address];
    const executors = [ethers.ZeroAddress];
    const admin = deployer.address;

    const timelockController = await TimelockController.deploy(
        timelockMinDelaySeconds,
        proposers,
        executors,
        admin
    );
    await timelockController.waitForDeployment();
    console.log("TimelockController deployed to:", timelockController.target);

    // 6. Set Inter-Contract Dependencies
    console.log("\nConfiguring inter-contract dependencies...");
    let tx = await ipRightsManager.setContentCreationContract(contentCreation.target);
    await tx.wait();
    console.log(`IPRightsManager's contentCreationContract set to: ${await ipRightsManager.contentCreationContract()}`);

    // 7. Transfer Ownership of Ownable Core Contracts to TimelockController
    console.log("\nTransferring ownership of core contracts to TimelockController...");

    tx = await ipRightsManager.transferOwnership(timelockController.target);
    await tx.wait();
    console.log(`IPRightsManager ownership transferred to TimelockController. New owner: ${await ipRightsManager.owner()}`);

    tx = await peripheralSales.transferOwnership(timelockController.target);
    await tx.wait();
    console.log(`PeripheralSales ownership transferred to TimelockController. New owner: ${await peripheralSales.owner()}`);

    tx = await valueSharing.transferOwnership(timelockController.target);
    await tx.wait();
    console.log(`ValueSharing ownership transferred to TimelockController. New owner: ${await valueSharing.owner()}`);

    // 8. Configure TimelockController Roles & Renounce Admin Role
    console.log("\nRenouncing deployer's ADMIN_ROLE on TimelockController...");
    const TIMELOCK_ADMIN_ROLE = await timelockController.TIMELOCK_ADMIN_ROLE();
    tx = await timelockController.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address);
    await tx.wait();
    console.log(`Deployer's ADMIN_ROLE on TimelockController renounced. Has role: ${await timelockController.hasRole(TIMELOCK_ADMIN_ROLE, deployer.address)}`);

    const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
    console.log(`Deployer's PROPOSER_ROLE on TimelockController. Has role: ${await timelockController.hasRole(PROPOSER_ROLE, deployer.address)}`);


    console.log("\n--- Deployment Summary ---");
    console.log("Deployer Account:", deployer.address);
    console.log("Platform Wallet (for ValueSharing):", platformWalletAddress);
    console.log("ContentCreation:", contentCreation.target);
    console.log("IPRightsManager:", ipRightsManager.target);
    console.log("PeripheralSales:", peripheralSales.target);
    console.log("ValueSharing:", valueSharing.target);
    console.log("TimelockController:", timelockController.target);
    console.log("Timelock Min Delay:", timelockMinDelaySeconds, "seconds");
    console.log("--- End of Deployment ---");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
