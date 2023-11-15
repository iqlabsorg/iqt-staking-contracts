// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library Constants {
    uint256 constant DECIMALS_PRECISION = 1e18;
    uint16 constant MAX_APY = 100_00;
    uint256 constant MONTHS_IN_YEAR = 12;
    uint256 constant DAYS_IN_YEAR = 365;
    uint256 constant SECONDS_IN_DAY = 86400;
    uint256 constant SECONDS_IN_MONTH = 30 * SECONDS_IN_DAY;
    uint256 constant SECONDS_IN_YEAR = 31536000;
}
