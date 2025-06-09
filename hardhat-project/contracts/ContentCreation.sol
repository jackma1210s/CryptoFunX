// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Counters.sol";

contract ContentCreation {
    using Counters for Counters.Counter;
    Counters.Counter private _contentIds;

    struct ContentItem {
        uint256 id;
        address creator;
        string ipfsHash; // IPFS hash of the content
        string description;
        uint256 timestamp;
    }

    mapping(uint256 => ContentItem) private _contentItems;
    mapping(address => uint256[]) private _creatorContentIds; // To track content created by each address

    event ContentCreated(
        uint256 indexed id,
        address indexed creator,
        string ipfsHash,
        string description,
        uint256 timestamp
    );

    constructor() {
        // Initialize any state variables if needed, though _contentIds starts at 0 by default
    }

    /**
     * @dev Registers new content.
     * @param _ipfsHash The IPFS hash of the content.
     * @param _description A description of the content.
     */
    function createContent(string memory _ipfsHash, string memory _description) public {
        _contentIds.increment();
        uint256 newContentId = _contentIds.current();

        ContentItem storage newItem = _contentItems[newContentId];
        newItem.id = newContentId;
        newItem.creator = msg.sender;
        newItem.ipfsHash = _ipfsHash;
        newItem.description = _description;
        newItem.timestamp = block.timestamp;

        _creatorContentIds[msg.sender].push(newContentId);

        emit ContentCreated(newContentId, msg.sender, _ipfsHash, _description, block.timestamp);
    }

    /**
     * @dev Retrieves a specific content item by its ID.
     * @param _contentId The ID of the content to retrieve.
     * @return The ContentItem struct.
     */
    function getContent(uint256 _contentId) public view returns (ContentItem memory) {
        require(_contentItems[_contentId].creator != address(0), "Content ID does not exist");
        return _contentItems[_contentId];
    }

    /**
     * @dev Retrieves all content items created by a specific address.
     * @param _creator The address of the creator.
     * @return An array of ContentItem structs.
     */
    function getContentsByCreator(address _creator) public view returns (ContentItem[] memory) {
        uint256[] storage creatorIds = _creatorContentIds[_creator];
        ContentItem[] memory items = new ContentItem[](creatorIds.length);

        for (uint256 i = 0; i < creatorIds.length; i++) {
            items[i] = _contentItems[creatorIds[i]];
        }
        return items;
    }

    /**
     * @dev Retrieves all content IDs created by a specific address.
     * @param _creator The address of the creator.
     * @return An array of content IDs.
     */
    function getContentIdsByCreator(address _creator) public view returns (uint256[] memory) {
        return _creatorContentIds[_creator];
    }
}
