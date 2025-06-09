const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ValueSharing", function () {
    const initialFee = 10;
    const productId = 1;
    const revenue = ethers.parseEther("10");

    async function deployValueSharingFixture() {
        const [owner, platformWallet, creator, otherAccount] = await ethers.getSigners();

        const ValueSharing = await ethers.getContractFactory("ValueSharing");
        const valueSharing = await ValueSharing.deploy(owner.address, platformWallet.address, initialFee);
        await valueSharing.waitForDeployment();

        return { valueSharing, owner, platformWallet, creator, otherAccount };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { valueSharing, owner } = await loadFixture(deployValueSharingFixture);
            expect(await valueSharing.owner()).to.equal(owner.address);
        });

        it("Should set initial platform wallet and fee", async function () {
            const { valueSharing, platformWallet } = await loadFixture(deployValueSharingFixture);
            expect(await valueSharing.platformWallet()).to.equal(platformWallet.address);
            expect(await valueSharing.platformFeePercentage()).to.equal(initialFee);
        });

        it("Should emit events for initial wallet and fee settings", async function() {
            const [owner, platformWalletSigner] = await ethers.getSigners();
            const ValueSharing = await ethers.getContractFactory("ValueSharing");
            const valueSharingInstance = await ValueSharing.deploy(owner.address, platformWalletSigner.address, initialFee);
            await valueSharingInstance.waitForDeployment();
            const deployTx = valueSharingInstance.deploymentTransaction();
            const deployTxReceipt = await deployTx.wait();

            let foundPlatformWalletSet = false;
            let foundPlatformFeePercentageSet = false;

            for (const log of deployTxReceipt.logs) {
                try {
                    const parsedLog = valueSharingInstance.interface.parseLog(log);
                    if (parsedLog.name === "PlatformWalletSet") {
                        expect(parsedLog.args[0]).to.equal(ethers.ZeroAddress);
                        expect(parsedLog.args[1]).to.equal(platformWalletSigner.address);
                        foundPlatformWalletSet = true;
                    }
                    if (parsedLog.name === "PlatformFeePercentageSet") {
                        expect(parsedLog.args[0]).to.equal(0);
                        expect(parsedLog.args[1]).to.equal(initialFee);
                        foundPlatformFeePercentageSet = true;
                    }
                } catch(e) { /* Not an event from this contract, ignore */ }
            }
            expect(foundPlatformWalletSet, "PlatformWalletSet event not found or args mismatch").to.be.true;
            expect(foundPlatformFeePercentageSet, "PlatformFeePercentageSet event not found or args mismatch").to.be.true;
        });


        it("Should revert if initial fee > 100", async function() {
            const [owner, platformWalletSigner] = await ethers.getSigners();
            const ValueSharing = await ethers.getContractFactory("ValueSharing");
            await expect(ValueSharing.deploy(owner.address, platformWalletSigner.address, 101))
                .to.be.revertedWith("ValueSharing: Fee percentage cannot exceed 100");
        });
        it("Should revert if initial platform wallet is zero address", async function() {
            const [owner] = await ethers.getSigners();
            const ValueSharing = await ethers.getContractFactory("ValueSharing");
            await expect(ValueSharing.deploy(owner.address, ethers.ZeroAddress, initialFee))
                .to.be.revertedWith("ValueSharing: Platform wallet cannot be zero address");
        });
    });

    describe("setPlatformFeePercentage", function () {
        it("Should allow owner to set fee", async function () {
            const { valueSharing, owner } = await loadFixture(deployValueSharingFixture);
            const newFee = 20;
            await expect(valueSharing.connect(owner).setPlatformFeePercentage(newFee))
                .to.emit(valueSharing, "PlatformFeePercentageSet").withArgs(initialFee, newFee);
            expect(await valueSharing.platformFeePercentage()).to.equal(newFee);
        });

        it("Should revert if non-owner tries", async function () {
            const { valueSharing, otherAccount } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(otherAccount).setPlatformFeePercentage(20))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert if fee > 100", async function () {
            const { valueSharing, owner } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(owner).setPlatformFeePercentage(101))
                .to.be.revertedWith("ValueSharing: Fee percentage cannot exceed 100");
        });
    });

    describe("setPlatformWallet", function () {
        it("Should allow owner to set wallet", async function () {
            const { valueSharing, owner, otherAccount, platformWallet } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(owner).setPlatformWallet(otherAccount.address))
                .to.emit(valueSharing, "PlatformWalletSet").withArgs(platformWallet.address, otherAccount.address);
            expect(await valueSharing.platformWallet()).to.equal(otherAccount.address);
        });

        it("Should revert if non-owner tries", async function () {
            const { valueSharing, otherAccount } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(otherAccount).setPlatformWallet(otherAccount.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert if new wallet is zero address", async function () {
            const { valueSharing, owner } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(owner).setPlatformWallet(ethers.ZeroAddress))
                .to.be.revertedWith("ValueSharing: New platform wallet cannot be zero address");
        });
    });

    describe("recordSaleAndCalculateShares (Stub)", function () {
        it("Should emit FundsDistributed with correct share calculation", async function () {
            const { valueSharing, creator, otherAccount } = await loadFixture(deployValueSharingFixture);
            const platformShare = (revenue * BigInt(initialFee)) / 100n;
            const creatorShare = revenue - platformShare;

            await expect(valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, revenue, {value: revenue}))
                .to.emit(valueSharing, "FundsDistributed")
                .withArgs(productId, creator.address, revenue, creatorShare, platformShare);
        });

        it("Should revert if creator is zero address", async function () {
            const { valueSharing, otherAccount } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, ethers.ZeroAddress, revenue, {value: revenue}))
                .to.be.revertedWith("ValueSharing: Creator address cannot be zero");
        });

        it("Should revert if total revenue is zero", async function () {
            const { valueSharing, creator, otherAccount } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, 0n, {value: 0n}))
                .to.be.revertedWith("ValueSharing: Total revenue must be positive");
        });

        it("Should accept Ether when recordSaleAndCalculateShares is called", async function() {
            const { valueSharing, creator, otherAccount } = await loadFixture(deployValueSharingFixture);
            const initialContractBalance = await ethers.provider.getBalance(valueSharing.target);

            await valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, revenue, {value: revenue});

            const finalContractBalance = await ethers.provider.getBalance(valueSharing.target);
            expect(finalContractBalance).to.equal(initialContractBalance + revenue);
        });
    });

    describe("withdrawPlatformFunds", function() {
        it("Should allow platformWallet to withdraw funds", async function() {
            const { valueSharing, platformWallet, otherAccount, creator } = await loadFixture(deployValueSharingFixture);
            await valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, revenue, {value: revenue});

            const contractBalanceBefore = await ethers.provider.getBalance(valueSharing.target);
            expect(contractBalanceBefore).to.equal(revenue);

            const platformWalletBalanceBefore = await ethers.provider.getBalance(platformWallet.address);

            const tx = await valueSharing.connect(platformWallet).withdrawPlatformFunds();
            const receipt = await tx.wait();
            const feeData = await ethers.provider.getFeeData();
            const gasPrice = tx.gasPrice || feeData.gasPrice;
            const gasUsed = receipt.gasUsed * gasPrice;

            const contractBalanceAfter = await ethers.provider.getBalance(valueSharing.target);
            const platformWalletBalanceAfter = await ethers.provider.getBalance(platformWallet.address);

            expect(contractBalanceAfter).to.equal(0n);
            expect(platformWalletBalanceAfter).to.equal(platformWalletBalanceBefore + revenue - gasUsed);
            await expect(tx).to.emit(valueSharing, "PlatformFundsWithdrawn").withArgs(platformWallet.address, revenue);
        });

        it("Should allow owner to withdraw funds (acting as platform wallet)", async function() {
             const { valueSharing, owner, otherAccount, creator, platformWallet } = await loadFixture(deployValueSharingFixture); // Added platformWallet
            await valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, revenue, {value: revenue});
            // We need to check platformWallet's balance change, not owner's, as funds go to platformWallet
            const platformWalletBalanceBefore = await ethers.provider.getBalance(platformWallet.address);

            const tx = await valueSharing.connect(owner).withdrawPlatformFunds();
            const receipt = await tx.wait();
            // Gas is paid by owner, but funds are received by platformWallet

            const platformWalletBalanceAfter = await ethers.provider.getBalance(platformWallet.address);
            expect(await ethers.provider.getBalance(valueSharing.target)).to.equal(0n);
            expect(platformWalletBalanceAfter).to.equal(platformWalletBalanceBefore + revenue);
        });

        it("Should revert if caller is not platform wallet or owner", async function() {
            const { valueSharing, otherAccount, creator } = await loadFixture(deployValueSharingFixture);
            await valueSharing.connect(otherAccount).recordSaleAndCalculateShares(productId, creator.address, revenue, {value: revenue});
            await expect(valueSharing.connect(otherAccount).withdrawPlatformFunds())
                .to.be.revertedWith("ValueSharing: Caller is not platform wallet or owner");
        });

        it("Should revert if no funds to withdraw", async function() {
            const { valueSharing, platformWallet } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(platformWallet).withdrawPlatformFunds())
                .to.be.revertedWith("ValueSharing: No funds to withdraw");
        });
    });

    describe("emergencyWithdraw", function() {
        it("Should allow owner to withdraw any funds", async function() {
            const { valueSharing, owner, otherAccount } = await loadFixture(deployValueSharingFixture);
            await otherAccount.sendTransaction({ to: valueSharing.target, value: revenue });

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
            const tx = await valueSharing.connect(owner).emergencyWithdraw();
            const receipt = await tx.wait();
            const feeData = await ethers.provider.getFeeData();
            const gasPrice = tx.gasPrice || feeData.gasPrice;
            const gasUsed = receipt.gasUsed * gasPrice;

            expect(await ethers.provider.getBalance(valueSharing.target)).to.equal(0n);
            expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBefore + revenue - gasUsed);
        });
        it("Should revert if non-owner tries emergency withdraw", async function() {
            const { valueSharing, otherAccount } = await loadFixture(deployValueSharingFixture);
            await otherAccount.sendTransaction({ to: valueSharing.target, value: revenue });
            await expect(valueSharing.connect(otherAccount).emergencyWithdraw())
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
         it("Should revert if no funds for emergency withdraw", async function() {
            const { valueSharing, owner } = await loadFixture(deployValueSharingFixture);
            await expect(valueSharing.connect(owner).emergencyWithdraw())
                .to.be.revertedWith("ValueSharing: No funds to withdraw");
        });
    });

    describe("receive Ether", function() {
        it("Should be able to receive Ether via receive()", async function() {
            const { valueSharing, otherAccount } = await loadFixture(deployValueSharingFixture);
            const initialBalance = await ethers.provider.getBalance(valueSharing.target);
            await otherAccount.sendTransaction({ to: valueSharing.target, value: revenue });
            const finalBalance = await ethers.provider.getBalance(valueSharing.target);
            expect(finalBalance).to.equal(initialBalance + revenue);
        });
    });
});
