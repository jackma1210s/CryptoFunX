// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// This contract is used to ensure Hardhat generates artifacts for imported contracts
// that might be deployed directly in scripts.
import "@openzeppelin/contracts/governance/TimelockController.sol";

contract ImportHelper {
    // This contract does not need to do anything.
    // Its sole purpose is to import contracts like TimelockController.
    TimelockController public dummyTimelock; // Optional: create a variable to ensure import isn't optimized away
}
