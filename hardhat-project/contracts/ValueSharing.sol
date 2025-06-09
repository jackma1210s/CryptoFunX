// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol"; // Using version ~4.9.3

contract ValueSharing is Ownable {
    uint256 public platformFeePercentage; // e.g., 5 for 5%
    address public platformWallet;

    event PlatformFeePercentageSet(uint256 oldPercentage, uint256 newPercentage);
    event PlatformWalletSet(address oldWallet, address indexed newWallet);
    event FundsDistributed(
        uint256 indexed productId,
        address indexed creator,
        uint256 totalRevenue,
        uint256 amountToCreator,
        uint256 amountToPlatform
    );
    // Event for actual fund withdrawal by platform (for later use)
    event PlatformFundsWithdrawn(address indexed to, uint256 amount);


    constructor(
        address initialOwner,
        address _platformWallet,
        uint256 _initialPlatformFeePercentage
    ) {
        require(initialOwner != address(0), "ValueSharing: Initial owner cannot be zero address");
        _transferOwnership(initialOwner); // Correct for OZ v4.x

        require(_platformWallet != address(0), "ValueSharing: Platform wallet cannot be zero address");
        platformWallet = _platformWallet;
        emit PlatformWalletSet(address(0), _platformWallet);

        require(_initialPlatformFeePercentage <= 100, "ValueSharing: Fee percentage cannot exceed 100");
        platformFeePercentage = _initialPlatformFeePercentage;
        emit PlatformFeePercentageSet(0, _initialPlatformFeePercentage);
    }

    /**
     * @dev Sets the platform's fee percentage. Max 100.
     */
    function setPlatformFeePercentage(uint256 _newPercentage) public onlyOwner {
        require(_newPercentage <= 100, "ValueSharing: Fee percentage cannot exceed 100");
        uint256 oldPercentage = platformFeePercentage;
        platformFeePercentage = _newPercentage;
        emit PlatformFeePercentageSet(oldPercentage, _newPercentage);
    }

    /**
     * @dev Sets the wallet address where platform fees are collected.
     */
    function setPlatformWallet(address _newWallet) public onlyOwner {
        require(_newWallet != address(0), "ValueSharing: New platform wallet cannot be zero address");
        address oldWallet = platformWallet;
        platformWallet = _newWallet;
        emit PlatformWalletSet(oldWallet, _newWallet);
    }

    /**
     * @dev Placeholder function to simulate fund distribution logic after a sale.
     * In a real system, this might be called by PeripheralSales contract, or PeripheralSales would transfer funds here.
     * For this stub, it only calculates and emits an event. No actual Ether transfer occurs from this function directly.
     * The contract would need to hold funds to distribute them.
     * @param _productId The ID of the product sold.
     * @param _creator The address of the IP creator/owner who should receive royalties.
     * @param _totalRevenue The total revenue received from the sale (e.g., msg.value if funds were sent here).
     */
    function recordSaleAndCalculateShares(
        uint256 _productId,
        address _creator,
        uint256 _totalRevenue
    ) public payable { // Made payable to simulate receiving funds, though it won't distribute them yet
        require(_creator != address(0), "ValueSharing: Creator address cannot be zero");
        require(_totalRevenue > 0, "ValueSharing: Total revenue must be positive");
        // require(msg.value == _totalRevenue, "ValueSharing: Sent Ether value must match total revenue"); // If this contract receives funds

        uint256 platformShare = (_totalRevenue * platformFeePercentage) / 100;
        uint256 creatorShare = _totalRevenue - platformShare;

        // IMPORTANT: This stub does NOT transfer Ether.
        // Actual Ether transfer would require this contract to hold the funds (e.g., PeripheralSales transfers to ValueSharing)
        // and then this contract would transfer out to platformWallet and creator.
        // That logic is deferred for security and complexity reasons in this initial stub.

        emit FundsDistributed(_productId, _creator, _totalRevenue, creatorShare, platformShare);

        // If this contract were to actually receive and distribute funds immediately:
        // payable(platformWallet).transfer(platformShare);
        // payable(_creator).transfer(creatorShare);
        // This would require careful checks and re-entrancy guards.
    }

    /**
     * @dev Allows the platform to withdraw its accumulated fees.
     * This function assumes that funds are sent to and held by this contract.
     */
    function withdrawPlatformFunds() public {
        require(platformWallet != address(0), "ValueSharing: Platform wallet not set");
        require(msg.sender == platformWallet || msg.sender == owner(), "ValueSharing: Caller is not platform wallet or owner");

        uint256 balance = address(this).balance;
        require(balance > 0, "ValueSharing: No funds to withdraw");

        // In a more complex system, you'd track platform fees separately from other funds.
        // For this simple version, we assume any balance is platform fees.
        payable(platformWallet).transfer(balance);
        emit PlatformFundsWithdrawn(platformWallet, balance);
    }

    // Function to allow owner to withdraw any ETH sent to the contract by mistake
    // (not part of core logic but good for admin)
    function emergencyWithdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "ValueSharing: No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    // Fallback to receive Ether if PeripheralSales contract sends it directly
    receive() external payable {}
}
