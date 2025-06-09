// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol"; // Using version ~4.9.3
import "@openzeppelin/contracts/utils/Strings.sol"; // For converting uint to string for error messages

contract IPRightsManager is Ownable {
    using Strings for uint256;

    // Mapping from content ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping from content ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Address of the ContentCreation contract, allowed to assign initial ownership
    address public contentCreationContract;

    // Events
    event OwnershipTransferred(uint256 indexed contentId, address indexed from, address indexed to);
    event Approval(uint256 indexed contentId, address indexed owner, address indexed approved);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event ContentCreationContractSet(address indexed newContractAddress);


    modifier onlyContentCreation() {
        require(msg.sender == contentCreationContract, "IPRightsManager: Caller is not the ContentCreation contract");
        _;
    }

    constructor(address initialOwner) { // Ownable() is implicitly called
        require(initialOwner != address(0), "IPRightsManager: Initial owner cannot be zero address");
        _transferOwnership(initialOwner);
        // The contentCreationContract will be set later by the owner.
    }

    /**
     * @dev Sets the address of the ContentCreation contract. Can only be called by the owner.
     */
    function setContentCreationContract(address _contractAddress) public onlyOwner {
        require(_contractAddress != address(0), "IPRightsManager: Zero address for ContentCreation contract");
        contentCreationContract = _contractAddress;
        emit ContentCreationContractSet(_contractAddress);
    }

    /**
     * @dev Assigns initial ownership of a content item.
     * Typically called by the ContentCreation contract.
     */
    function assignInitialOwnership(uint256 _contentId, address _creator) public onlyContentCreation {
        require(_creator != address(0), "IPRightsManager: Assign to the zero address");
        require(_owners[_contentId] == address(0), "IPRightsManager: Content ID already has an owner");
        _owners[_contentId] = _creator;
        emit OwnershipTransferred(_contentId, address(0), _creator);
    }

    /**
     * @dev Returns the owner of the specified content ID.
     */
    function ownerOf(uint256 _contentId) public view returns (address) {
        address owner = _owners[_contentId];
        require(owner != address(0), "IPRightsManager: Query for nonexistent content ID");
        return owner;
    }

    /**
     * @dev Approves an address to operate on a specific content ID.
     */
    function approve(address _approved, uint256 _contentId) public {
        address owner = ownerOf(_contentId); // This will revert if contentId doesn't exist
        require(_approved != owner, "IPRightsManager: Approval to current owner");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "IPRightsManager: Approve caller is not owner nor approved for all");

        _tokenApprovals[_contentId] = _approved;
        emit Approval(_contentId, owner, _approved);
    }

    /**
     * @dev Gets the approved address for a single content ID.
     */
    function getApproved(uint256 _contentId) public view returns (address) {
        require(_owners[_contentId] != address(0), "IPRightsManager: Approved query for nonexistent content ID");
        return _tokenApprovals[_contentId];
    }

    /**
     * @dev Sets or unsets the approval of a given operator.
     * An operator is allowed to transfer all tokens of the sender on their behalf.
     */
    function setApprovalForAll(address _operator, bool _approved) public {
        require(_operator != msg.sender, "IPRightsManager: Approve to caller");
        _operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    /**
     * @dev Tells whether an operator is approved by a given owner.
     */
    function isApprovedForAll(address _owner, address _operator) public view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    /**
     * @dev Transfers ownership of a content ID to another address.
     * Requires the caller to be the owner, approved, or an operator.
     */
    function transferFrom(address _from, address _to, uint256 _contentId) public {
        require(_isApprovedOrOwner(msg.sender, _contentId), "IPRightsManager: Transfer caller is not owner nor approved");
        require(ownerOf(_contentId) == _from, "IPRightsManager: Transfer from incorrect owner");
        require(_to != address(0), "IPRightsManager: Transfer to the zero address");

        // Clear approvals from the previous owner
        _approve(address(0), _contentId, _from); // Internal approval function

        _owners[_contentId] = _to;
        emit OwnershipTransferred(_contentId, _from, _to);
    }

    /**
     * @dev Internal function to approve an address for a token.
     * Owner is required for the event.
     */
    function _approve(address _approved, uint256 _contentId, address _owner) internal {
        _tokenApprovals[_contentId] = _approved;
        emit Approval(_contentId, _owner, _approved);
    }

    /**
     * @dev Internal function to check if an address is owner, approved or operator.
     */
    function _isApprovedOrOwner(address _spender, uint256 _contentId) internal view returns (bool) {
        address owner = _owners[_contentId]; // Reverts if contentId does not exist via ownerOf logic implicitly
        if (owner == address(0)) return false; // Should not happen if ownerOf is used, but as a safeguard
        return (_spender == owner || getApproved(_contentId) == _spender || isApprovedForAll(owner, _spender));
    }
}
