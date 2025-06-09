// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For owner-only functions like setting IPRightsManager address
import "./IPRightsManager.sol"; // Interface or direct import

// Forward declaration for IPRightsManager if using it as a type before full definition/interface
// contract IPRightsManager { function ownerOf(uint256 contentId) public view returns (address) {} }

contract PeripheralSales is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _productIds;

    IPRightsManager public ipRightsManager;

    struct ProductInfo {
        uint256 productId;
        uint256 contentId; // Links to the IP in IPRightsManager
        address designer;
        uint256 price;
        string ipfsHashDesign; // IPFS hash of the design files
        string description;
        bool isActive; // To allow deactivation of products
    }

    mapping(uint256 => ProductInfo) private _products;
    mapping(uint256 => uint256[]) private _contentToProductIds; // contentId to array of productIds

    event ProductRegistered(
        uint256 indexed productId,
        uint256 indexed contentId,
        address indexed designer,
        uint256 price,
        string ipfsHashDesign
    );

    event ProductActivationChanged(uint256 indexed productId, bool isActive);
    event IPRightsManagerAddressSet(address indexed newAddress);

    modifier onlyValidIPRightsManager() {
        require(address(ipRightsManager) != address(0), "PeripheralSales: IPRightsManager address not set");
        _;
    }

    constructor(address initialOwner, address _ipRightsManagerAddress) {
        require(initialOwner != address(0), "PeripheralSales: Initial owner cannot be zero address");
        _transferOwnership(initialOwner); // Corrected for OZ v4.x Ownable
        if (_ipRightsManagerAddress != address(0)) {
            ipRightsManager = IPRightsManager(_ipRightsManagerAddress);
            emit IPRightsManagerAddressSet(_ipRightsManagerAddress);
        }
    }

    /**
     * @dev Allows the owner to set or update the IPRightsManager contract address.
     */
    function setIPRightsManager(address _newAddress) public onlyOwner {
        require(_newAddress != address(0), "PeripheralSales: New IPRightsManager address cannot be zero");
        ipRightsManager = IPRightsManager(_newAddress);
        emit IPRightsManagerAddressSet(_newAddress);
    }

    /**
     * @dev Registers a new peripheral product design.
     * The caller (designer) must be the owner of the linked content ID.
     */
    function registerProduct(
        uint256 _contentId,
        uint256 _price,
        string memory _ipfsHashDesign,
        string memory _description
    ) public onlyValidIPRightsManager {
        require(ipRightsManager.ownerOf(_contentId) == msg.sender, "PeripheralSales: Caller is not the owner of the content ID");
        require(_price > 0, "PeripheralSales: Price must be greater than zero"); // Basic validation

        _productIds.increment();
        uint256 newProductId = _productIds.current();

        _products[newProductId] = ProductInfo({
            productId: newProductId,
            contentId: _contentId,
            designer: msg.sender,
            price: _price,
            ipfsHashDesign: _ipfsHashDesign,
            description: _description,
            isActive: true // Active by default
        });

        _contentToProductIds[_contentId].push(newProductId);

        emit ProductRegistered(newProductId, _contentId, msg.sender, _price, _ipfsHashDesign);
    }

    /**
     * @dev Retrieves product information for a given product ID.
     */
    function getProduct(uint256 _productId) public view returns (ProductInfo memory) {
        require(_products[_productId].designer != address(0), "PeripheralSales: Product does not exist");
        return _products[_productId];
    }

    /**
     * @dev Retrieves all product IDs associated with a specific content ID.
     */
    function getProductIdsByContentId(uint256 _contentId) public view returns (uint256[] memory) {
        return _contentToProductIds[_contentId];
    }

    /**
     * @dev Allows the designer of a product to activate or deactivate it.
     */
    function setProductActiveStatus(uint256 _productId, bool _isActive) public {
        ProductInfo storage product = _products[_productId];
        require(product.designer != address(0), "PeripheralSales: Product does not exist");
        require(product.designer == msg.sender, "PeripheralSales: Caller is not the designer of the product");

        product.isActive = _isActive;
        emit ProductActivationChanged(_productId, _isActive);
    }

    // Basic function to simulate a purchase - details will be expanded later
    // For now, it doesn't do much other than check if the product is active and exists.
    function buyProduct(uint256 _productId) public payable {
        ProductInfo storage product = _products[_productId];
        require(product.designer != address(0), "PeripheralSales: Product does not exist");
        require(product.isActive, "PeripheralSales: Product is not active");
        require(msg.value >= product.price, "PeripheralSales: Insufficient payment for the product");

        // Further logic for payment handling, order creation, event emission etc. will be added in later phases.
        // For example, transferring funds to the designer/platform, emitting a ProductSold event.

        // Placeholder for now: refund if overpaid (not ideal for real scenarios due to gas costs)
        if (msg.value > product.price) {
            payable(msg.sender).transfer(msg.value - product.price);
        }
        // Actual fund transfer to seller/platform would happen here.
    }
}
