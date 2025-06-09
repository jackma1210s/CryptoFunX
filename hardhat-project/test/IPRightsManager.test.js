const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IPRightsManager", function () {
    const contentId1 = 1;
    const contentId2 = 2;
    const nonExistentContentId = 99;

    async function deployIPRightsManagerFixture() {
        const [owner, contentCreatorContract, user1, user2, otherAccount] = await ethers.getSigners();

        const IPRightsManager = await ethers.getContractFactory("IPRightsManager");
        const ipRightsManager = await IPRightsManager.deploy(owner.address);
        await ipRightsManager.waitForDeployment();

        await ipRightsManager.connect(owner).setContentCreationContract(contentCreatorContract.address);

        return { ipRightsManager, owner, contentCreatorContract, user1, user2, otherAccount };
    }

    describe("Deployment", function () {
        it("Should set the right initial owner for IPRM", async function () {
            const { ipRightsManager, owner } = await loadFixture(deployIPRightsManagerFixture);
            expect(await ipRightsManager.owner()).to.equal(owner.address);
        });
        it("Should have contentCreationContract initially unset if not done in fixture", async function() {
            const [ownerSigner] = await ethers.getSigners();
            const IPRightsManager = await ethers.getContractFactory("IPRightsManager");
            const iprm = await IPRightsManager.deploy(ownerSigner.address);
            await iprm.waitForDeployment();
            expect(await iprm.contentCreationContract()).to.equal(ethers.ZeroAddress);
        });
    });

    describe("setContentCreationContract", function () {
        it("Should allow owner to set ContentCreation contract address", async function () {
            const { ipRightsManager, owner, otherAccount } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(owner).setContentCreationContract(otherAccount.address))
                .to.emit(ipRightsManager, "ContentCreationContractSet").withArgs(otherAccount.address);
            expect(await ipRightsManager.contentCreationContract()).to.equal(otherAccount.address);
        });

        it("Should revert if non-owner tries to set ContentCreation contract address", async function () {
            const { ipRightsManager, otherAccount } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(otherAccount).setContentCreationContract(otherAccount.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
         it("Should revert if setting ContentCreation contract to zero address", async function () {
            const { ipRightsManager, owner } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(owner).setContentCreationContract(ethers.ZeroAddress))
                .to.be.revertedWith("IPRightsManager: Zero address for ContentCreation contract");
        });
    });

    describe("assignInitialOwnership", function () {
        it("Should allow authorized ContentCreation contract to assign ownership", async function () {
            const { ipRightsManager, contentCreatorContract, user1 } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(contentCreatorContract).assignInitialOwnership(contentId1, user1.address))
                .to.emit(ipRightsManager, "OwnershipTransferred(uint256,address,address)").withArgs(contentId1, ethers.ZeroAddress, user1.address);
            expect(await ipRightsManager.ownerOf(contentId1)).to.equal(user1.address);
        });

        it("Should revert if unauthorized address tries to assign ownership", async function () {
            const { ipRightsManager, otherAccount, user1 } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(otherAccount).assignInitialOwnership(contentId1, user1.address))
                .to.be.revertedWith("IPRightsManager: Caller is not the ContentCreation contract");
        });

        it("Should revert if assigning to zero address", async function () {
            const { ipRightsManager, contentCreatorContract } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.connect(contentCreatorContract).assignInitialOwnership(contentId1, ethers.ZeroAddress))
                .to.be.revertedWith("IPRightsManager: Assign to the zero address");
        });

        it("Should revert if content ID already has an owner", async function () {
            const { ipRightsManager, contentCreatorContract, user1, user2 } = await loadFixture(deployIPRightsManagerFixture);
            await ipRightsManager.connect(contentCreatorContract).assignInitialOwnership(contentId1, user1.address);
            await expect(ipRightsManager.connect(contentCreatorContract).assignInitialOwnership(contentId1, user2.address))
                .to.be.revertedWith("IPRightsManager: Content ID already has an owner");
        });
    });

    describe("ownerOf", function () {
        it("Should return correct owner", async function () {
            const { ipRightsManager, contentCreatorContract, user1 } = await loadFixture(deployIPRightsManagerFixture);
            await ipRightsManager.connect(contentCreatorContract).assignInitialOwnership(contentId1, user1.address);
            expect(await ipRightsManager.ownerOf(contentId1)).to.equal(user1.address);
        });

        it("Should revert for nonexistent content ID", async function () {
            const { ipRightsManager } = await loadFixture(deployIPRightsManagerFixture);
            await expect(ipRightsManager.ownerOf(nonExistentContentId))
                .to.be.revertedWith("IPRightsManager: Query for nonexistent content ID");
        });
    });

    describe("With Existing Token", function() {
        async function fixtureWithOwner() {
            const base = await loadFixture(deployIPRightsManagerFixture);
            await base.ipRightsManager.connect(base.contentCreatorContract).assignInitialOwnership(contentId1, base.user1.address);
            await base.ipRightsManager.connect(base.contentCreatorContract).assignInitialOwnership(contentId2, base.user2.address);
            return base;
        }

        describe("approve", function () {
            it("Should allow owner to approve an address", async function () {
                const { ipRightsManager, user1, otherAccount } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).approve(otherAccount.address, contentId1))
                    .to.emit(ipRightsManager, "Approval").withArgs(contentId1, user1.address, otherAccount.address);
                expect(await ipRightsManager.getApproved(contentId1)).to.equal(otherAccount.address);
            });

            it("Should revert if non-owner tries to approve", async function () {
                const { ipRightsManager, otherAccount, user2 } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(otherAccount).approve(user2.address, contentId1))
                    .to.be.revertedWith("IPRightsManager: Approve caller is not owner nor approved for all");
            });

            it("Should revert approval to current owner", async function () {
                const { ipRightsManager, user1 } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).approve(user1.address, contentId1))
                    .to.be.revertedWith("IPRightsManager: Approval to current owner");
            });

            it("Should allow approved operator to approve an address", async function () {
                const { ipRightsManager, user1, otherAccount, user2 } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).setApprovalForAll(otherAccount.address, true);
                await expect(ipRightsManager.connect(otherAccount).approve(user2.address, contentId1))
                    .to.emit(ipRightsManager, "Approval").withArgs(contentId1, user1.address, user2.address);
                expect(await ipRightsManager.getApproved(contentId1)).to.equal(user2.address);
            });
        });

        describe("getApproved", function () {
            it("Should return approved address", async function () {
                const { ipRightsManager, user1, otherAccount } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).approve(otherAccount.address, contentId1);
                expect(await ipRightsManager.getApproved(contentId1)).to.equal(otherAccount.address);
            });

            it("Should return zero address if no approval", async function () {
                const { ipRightsManager } = await loadFixture(fixtureWithOwner);
                expect(await ipRightsManager.getApproved(contentId1)).to.equal(ethers.ZeroAddress);
            });

            it("Should revert for nonexistent content ID", async function () {
                 const { ipRightsManager } = await loadFixture(fixtureWithOwner);
                 await expect(ipRightsManager.getApproved(nonExistentContentId))
                    .to.be.revertedWith("IPRightsManager: Approved query for nonexistent content ID");
            });
        });

        describe("setApprovalForAll", function () {
            it("Should allow owner to approve operator for all content", async function () {
                const { ipRightsManager, user1, otherAccount } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).setApprovalForAll(otherAccount.address, true))
                    .to.emit(ipRightsManager, "ApprovalForAll").withArgs(user1.address, otherAccount.address, true);
                expect(await ipRightsManager.isApprovedForAll(user1.address, otherAccount.address)).to.be.true;
            });
            it("Should revert if approving self as operator", async function () {
                const { ipRightsManager, user1 } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).setApprovalForAll(user1.address, true))
                    .to.be.revertedWith("IPRightsManager: Approve to caller");
            });
        });

        describe("isApprovedForAll", function () {
            it("Should return true for approved operator, false otherwise", async function () {
                const { ipRightsManager, user1, otherAccount, user2 } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).setApprovalForAll(otherAccount.address, true);
                expect(await ipRightsManager.isApprovedForAll(user1.address, otherAccount.address)).to.be.true;
                expect(await ipRightsManager.isApprovedForAll(user1.address, user2.address)).to.be.false;
            });
        });

        describe("transferFrom", function () {
            it("Should allow owner to transfer", async function () {
                const { ipRightsManager, user1, user2 } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).transferFrom(user1.address, user2.address, contentId1))
                    .to.emit(ipRightsManager, "OwnershipTransferred(uint256,address,address)").withArgs(contentId1, user1.address, user2.address);
                expect(await ipRightsManager.ownerOf(contentId1)).to.equal(user2.address);
                expect(await ipRightsManager.getApproved(contentId1)).to.equal(ethers.ZeroAddress);
            });

            it("Should allow approved address to transfer", async function () {
                const { ipRightsManager, user1, user2, otherAccount } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).approve(otherAccount.address, contentId1);
                await expect(ipRightsManager.connect(otherAccount).transferFrom(user1.address, user2.address, contentId1))
                    .to.emit(ipRightsManager, "OwnershipTransferred(uint256,address,address)").withArgs(contentId1, user1.address, user2.address);
                expect(await ipRightsManager.ownerOf(contentId1)).to.equal(user2.address);
            });

            it("Should allow operator to transfer", async function () {
                const { ipRightsManager, user1, user2, otherAccount } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).setApprovalForAll(otherAccount.address, true);
                await expect(ipRightsManager.connect(otherAccount).transferFrom(user1.address, user2.address, contentId1))
                    .to.emit(ipRightsManager, "OwnershipTransferred(uint256,address,address)").withArgs(contentId1, user1.address, user2.address);
                expect(await ipRightsManager.ownerOf(contentId1)).to.equal(user2.address);
            });

            it("Should revert if caller is not authorized", async function () {
                const { ipRightsManager, user1, user2, otherAccount } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(otherAccount).transferFrom(user1.address, user2.address, contentId1))
                    .to.be.revertedWith("IPRightsManager: Transfer caller is not owner nor approved");
            });

            it("Should revert if transferring from incorrect owner", async function () {
                const { ipRightsManager, user1, user2, otherAccount } = await loadFixture(fixtureWithOwner);
                await ipRightsManager.connect(user1).approve(otherAccount.address, contentId1);
                await expect(ipRightsManager.connect(otherAccount).transferFrom(user2.address, otherAccount.address, contentId1))
                    .to.be.revertedWith("IPRightsManager: Transfer from incorrect owner");
            });

            it("Should revert if transferring to zero address", async function () {
                const { ipRightsManager, user1 } = await loadFixture(fixtureWithOwner);
                await expect(ipRightsManager.connect(user1).transferFrom(user1.address, ethers.ZeroAddress, contentId1))
                    .to.be.revertedWith("IPRightsManager: Transfer to the zero address");
            });
        });
    });
});
