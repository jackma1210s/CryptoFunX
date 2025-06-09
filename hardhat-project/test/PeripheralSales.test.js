const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PeripheralSales", function () {
    const contentId1 = 1;
    const productPrice = ethers.parseEther("1.0");
    const ipfsDesignHash = "QmDesignHash123";
    const productDescription = "A cool T-Shirt";

    async function deployPeripheralSalesFixture() {
        const [owner, designer, buyer, otherAccount, contentCreatorContractPlaceholder] = await ethers.getSigners();

        const IPRightsManager = await ethers.getContractFactory("IPRightsManager");
        const ipRightsManager = await IPRightsManager.deploy(owner.address);
        await ipRightsManager.waitForDeployment();
        await ipRightsManager.connect(owner).setContentCreationContract(contentCreatorContractPlaceholder.address);
        await ipRightsManager.connect(contentCreatorContractPlaceholder).assignInitialOwnership(contentId1, designer.address);

        const PeripheralSales = await ethers.getContractFactory("PeripheralSales");
        const peripheralSales = await PeripheralSales.deploy(owner.address, await ipRightsManager.getAddress());
        await peripheralSales.waitForDeployment();

        return { peripheralSales, ipRightsManager, owner, designer, buyer, otherAccount, contentCreatorContractPlaceholder };
    }

    describe("Deployment", function () {
        it("Should set the right owner for PeripheralSales", async function () {
            const { peripheralSales, owner } = await loadFixture(deployPeripheralSalesFixture);
            expect(await peripheralSales.owner()).to.equal(owner.address);
        });

        it("Should set the IPRightsManager address", async function () {
            const { peripheralSales, ipRightsManager } = await loadFixture(deployPeripheralSalesFixture);
            expect(await peripheralSales.ipRightsManager()).to.equal(await ipRightsManager.getAddress());
        });
    });

    describe("setIPRightsManager", function() {
        it("Should allow owner to set IPRightsManager address", async function() {
            const { peripheralSales, owner, otherAccount } = await loadFixture(deployPeripheralSalesFixture);
            const newIprmAddr = otherAccount.address;
            await expect(peripheralSales.connect(owner).setIPRightsManager(newIprmAddr))
                .to.emit(peripheralSales, "IPRightsManagerAddressSet").withArgs(newIprmAddr);
            expect(await peripheralSales.ipRightsManager()).to.equal(newIprmAddr);
        });
        it("Should revert if non-owner tries to set", async function() {
            const { peripheralSales, otherAccount } = await loadFixture(deployPeripheralSalesFixture);
            await expect(peripheralSales.connect(otherAccount).setIPRightsManager(otherAccount.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
        it("Should revert if setting to zero address", async function() {
            const { peripheralSales, owner } = await loadFixture(deployPeripheralSalesFixture);
            await expect(peripheralSales.connect(owner).setIPRightsManager(ethers.ZeroAddress))
                .to.be.revertedWith("PeripheralSales: New IPRightsManager address cannot be zero");
        });
    });

    describe("registerProduct", function () {
        it("Should allow content owner to register a product", async function () {
            const { peripheralSales, designer } = await loadFixture(deployPeripheralSalesFixture);
            const tx = await peripheralSales.connect(designer).registerProduct(contentId1, productPrice, ipfsDesignHash, productDescription);
            await expect(tx).to.emit(peripheralSales, "ProductRegistered")
                 .withArgs(1, contentId1, designer.address, productPrice, ipfsDesignHash);
            const product = await peripheralSales.getProduct(1);
            expect(product.contentId).to.equal(contentId1);
            expect(product.designer).to.equal(designer.address);
            expect(product.price).to.equal(productPrice);
        });

        it("Should revert if caller is not content owner", async function () {
            const { peripheralSales, otherAccount } = await loadFixture(deployPeripheralSalesFixture);
            await expect(peripheralSales.connect(otherAccount).registerProduct(contentId1, productPrice, ipfsDesignHash, productDescription))
                .to.be.revertedWith("PeripheralSales: Caller is not the owner of the content ID");
        });

        it("Should revert if price is 0", async function () {
            const { peripheralSales, designer } = await loadFixture(deployPeripheralSalesFixture);
            await expect(peripheralSales.connect(designer).registerProduct(contentId1, 0, ipfsDesignHash, productDescription))
                .to.be.revertedWith("PeripheralSales: Price must be greater than zero");
        });

        it("Should revert if IPRightsManager is not set (e.g. to address(0))", async function() {
            const [owner, designer] = await ethers.getSigners();
            const PeripheralSalesFactory = await ethers.getContractFactory("PeripheralSales");
            // Deploy with ZeroAddress for IPRM to test the modifier directly
            const salesWithZeroIprm = await PeripheralSalesFactory.deploy(owner.address, ethers.ZeroAddress);
            await salesWithZeroIprm.waitForDeployment();

            await expect(salesWithZeroIprm.connect(designer).registerProduct(contentId1, productPrice, ipfsDesignHash, productDescription))
                .to.be.revertedWith("PeripheralSales: IPRightsManager address not set");
        });
    });

    describe("With Registered Product", function() {
        async function fixtureWithProduct() {
            const base = await loadFixture(deployPeripheralSalesFixture);
            await base.peripheralSales.connect(base.designer).registerProduct(contentId1, productPrice, ipfsDesignHash, productDescription);
            return base;
        }

        describe("getProduct", function () {
            it("Should return correct product info", async function () {
                const { peripheralSales, designer } = await loadFixture(fixtureWithProduct);
                const product = await peripheralSales.getProduct(1);
                expect(product.productId).to.equal(1);
                expect(product.designer).to.equal(designer.address);
                expect(product.ipfsHashDesign).to.equal(ipfsDesignHash);
            });

            it("Should revert for non-existent product ID", async function () {
                const { peripheralSales } = await loadFixture(fixtureWithProduct);
                await expect(peripheralSales.getProduct(99)).to.be.revertedWith("PeripheralSales: Product does not exist");
            });
        });

        describe("getProductIdsByContentId", function() {
            it("Should return product IDs for a content ID", async function() {
                const { peripheralSales } = await loadFixture(fixtureWithProduct);
                const productIds = await peripheralSales.getProductIdsByContentId(contentId1);
                expect(productIds.length).to.equal(1);
                expect(productIds[0]).to.equal(1);
            });
            it("Should return empty array for content ID with no products", async function() {
                const { peripheralSales } = await loadFixture(fixtureWithProduct);
                const productIds = await peripheralSales.getProductIdsByContentId(222);
                expect(productIds.length).to.equal(0);
            });
        });

        describe("setProductActiveStatus", function () {
            it("Should allow designer to change active status", async function () {
                const { peripheralSales, designer } = await loadFixture(fixtureWithProduct);
                await expect(peripheralSales.connect(designer).setProductActiveStatus(1, false))
                    .to.emit(peripheralSales, "ProductActivationChanged").withArgs(1, false);
                const product = await peripheralSales.getProduct(1);
                expect(product.isActive).to.be.false;
            });

            it("Should revert if non-designer tries to change status", async function () {
                const { peripheralSales, otherAccount } = await loadFixture(fixtureWithProduct);
                await expect(peripheralSales.connect(otherAccount).setProductActiveStatus(1, false))
                    .to.be.revertedWith("PeripheralSales: Caller is not the designer of the product");
            });
        });

        describe("buyProduct (Basic Stub Tests)", function () {
            it("Should revert if product is not active", async function () {
                const { peripheralSales, designer, buyer } = await loadFixture(fixtureWithProduct);
                await peripheralSales.connect(designer).setProductActiveStatus(1, false);
                await expect(peripheralSales.connect(buyer).buyProduct(1, { value: productPrice }))
                    .to.be.revertedWith("PeripheralSales: Product is not active");
            });

            it("Should revert if payment is insufficient", async function () {
                const { peripheralSales, buyer } = await loadFixture(fixtureWithProduct);
                const insufficientPayment = ethers.parseEther("0.5");
                await expect(peripheralSales.connect(buyer).buyProduct(1, { value: insufficientPayment }))
                    .to.be.revertedWith("PeripheralSales: Insufficient payment for the product");
            });

            it("Should accept payment if product active and payment sufficient (no actual transfer yet)", async function () {
                const { peripheralSales, buyer } = await loadFixture(fixtureWithProduct);
                await expect(peripheralSales.connect(buyer).buyProduct(1, { value: productPrice })).to.not.be.reverted;
            });

            it("Should refund overpayment (basic check)", async function () {
                const { peripheralSales, buyer } = await loadFixture(fixtureWithProduct);
                const overPayment = ethers.parseEther("1.5");
                const initialBalance = await ethers.provider.getBalance(buyer.address);

                const tx = await peripheralSales.connect(buyer).buyProduct(1, { value: overPayment });
                const receipt = await tx.wait();
                const feeData = await ethers.provider.getFeeData();
                const gasPrice = tx.gasPrice || feeData.gasPrice;
                const gasUsed = receipt.gasUsed * gasPrice;
                const finalBalance = await ethers.provider.getBalance(buyer.address);

                const expectedBalance = initialBalance - productPrice - gasUsed;
                const delta = ethers.parseUnits("0.001", "ether");
                expect(finalBalance >= expectedBalance - delta && finalBalance <= expectedBalance + delta).to.be.true;
            });
        });
    });
});
