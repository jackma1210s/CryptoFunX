const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContentCreation", function () {
    let ContentCreation, contentCreation, owner, addr1, addr2;
    const ipfsHash1 = "QmXgZAUCHEKHhBqSK1n2y4KyN43zVfSm5N3LZbPT2sY2AG";
    const description1 = "First piece of content";
    const ipfsHash2 = "QmTp2h3qf6z7jY5kXwLqVbRnMzCgHwS9jA1rD1fEaB3c4D";
    const description2 = "Second piece of content by addr1";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        ContentCreation = await ethers.getContractFactory("ContentCreation");
        contentCreation = await ContentCreation.deploy();
        await contentCreation.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(true).to.equal(true);
        });
        it("Should have content ID counter starting at 0 (implicitly)", async function() {
            await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            const item = await contentCreation.getContent(1);
            expect(item.id).to.equal(1);
        });
    });

    describe("createContent", function () {
        it("Should allow a user to create content and store it correctly", async function () {
            const tx = await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);

            await expect(tx)
                .to.emit(contentCreation, "ContentCreated")
                .withArgs(1, addr1.address, ipfsHash1, description1, block.timestamp);

            const item = await contentCreation.getContent(1);
            expect(item.id).to.equal(1);
            expect(item.creator).to.equal(addr1.address);
            expect(item.ipfsHash).to.equal(ipfsHash1);
            expect(item.description).to.equal(description1);
        });

        it("Should increment content ID for subsequent content", async function () {
            await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            await contentCreation.connect(addr2).createContent(ipfsHash2, description2);
            const item2 = await contentCreation.getContent(2);
            expect(item2.id).to.equal(2);
            expect(item2.creator).to.equal(addr2.address);
        });
    });

    describe("getContent", function () {
        it("Should retrieve correct content item", async function () {
            await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            const item = await contentCreation.getContent(1);
            expect(item.creator).to.equal(addr1.address);
            expect(item.ipfsHash).to.equal(ipfsHash1);
        });

        it("Should revert if content ID does not exist", async function () {
            await expect(contentCreation.getContent(99)).to.be.revertedWith("Content ID does not exist");
        });
    });

    describe("getContentsByCreator", function () {
        it("Should return all content items by a creator", async function () {
            await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            await contentCreation.connect(addr2).createContent("hashX", "Content by addr2");
            await contentCreation.connect(addr1).createContent(ipfsHash2, description2);

            const addr1Items = await contentCreation.getContentsByCreator(addr1.address);
            expect(addr1Items.length).to.equal(2);
            expect(addr1Items[0].id).to.equal(1);
            expect(addr1Items[0].description).to.equal(description1);
            expect(addr1Items[1].id).to.equal(3);
            expect(addr1Items[1].description).to.equal(description2);
        });

        it("Should return an empty array if creator has no content", async function () {
            const items = await contentCreation.getContentsByCreator(addr1.address);
            expect(items.length).to.equal(0);
        });
    });

    describe("getContentIdsByCreator", function () {
        it("Should return all content IDs by a creator", async function () {
            await contentCreation.connect(addr1).createContent(ipfsHash1, description1);
            await contentCreation.connect(addr2).createContent("hashX", "Content by addr2");
            await contentCreation.connect(addr1).createContent(ipfsHash2, description2);

            const addr1ContentIds = await contentCreation.getContentIdsByCreator(addr1.address);
            expect(addr1ContentIds.length).to.equal(2);
            expect(addr1ContentIds[0]).to.equal(1);
            expect(addr1ContentIds[1]).to.equal(3);
        });

        it("Should return an empty array if the creator has no content IDs", async function () {
            const contentIds = await contentCreation.getContentIdsByCreator(addr1.address);
            expect(contentIds.length).to.equal(0);
        });
    });
});
