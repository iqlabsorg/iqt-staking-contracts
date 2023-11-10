// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStaking {
    /**
     * @dev Reverts if `caller` is not a stake owner.
     * @param stakeId Unique stake ID.
     */
    error CallerIsNotStakeOwner(uint256 stakeId);

    /**
     * @dev Reverts if the withdrawal is not enabled.
     */
    error EarlyWithdrawalNotAllowed(uint256 currentTimestamp, uint256 endTimestamp);

    /**
     * @dev Reverts if the stake does not exist.
     * @param stakeId Unique stake ID.
     */
    error StakeDoesNotExist(uint256 stakeId);

    /**
     * @dev Reverts if the stake has already been withdrawn.
     * @param stakeId Unique stake ID.
     */
    error StakeAlreadyWithdrawn(uint256 stakeId);

    /**
     * @dev Reverts if the stake has not yet ended.
     * @param stakeId Unique stake ID.
     */
    error StakeNotYetEnded(uint256 stakeId);

    /**
     * @dev Reverts if the stake amount is less than the minimum stake.
     * @param amount Amount of tokens to stake.
    */
    error AmountIsLessThanMinimumStake(uint256 amount);

    /**
     * @dev Reverts if the stake amount is greater than the maximum stake.
     * @param amount Amount of tokens to stake.
    */
    error AmountIsGreaterThanMaximumStake(uint256 amount);

    /**
     * @dev Reverts if the staking plan does not exist.
     * @param requiredAllowance Amount of tokens required to be allowed.
     * @param currentAllowance Amount of tokens currently allowed.
     */
    error InsufficientAllowance(uint256 requiredAllowance, uint256 currentAllowance);

    /**
     * @dev Emitted when a stake is added.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     */
    event StakeAdded(address indexed staker, uint256 indexed stakeId);

    /**
     * @dev Emitted when a stake is withdrawn.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     */
    event StakeWithdrawn(address indexed staker, uint256 indexed stakeId);

    /**
     * @dev Stake data.
     * @param amount Amount of tokens staked.
     * @param stakingPlanId Index of the staking plan.
     * @param startTimestamp Timestamp when the stake was created.
     * @param endTimestamp Timestamp when the stake will end.
     * @param earningsInTokens Amount of tokens earned (calculated after withdraw).
     * @param earningsPercentage Percentage of tokens earned (calculated after withdraw).
     * @param earlyWithdrawal Whether the stake was withdrawn before the end.
     * @param withdrawn Whether the stake has been withdrawn.
     */
    struct Stake {
        address staker;
        uint256 amount;
        uint256 stakingPlanId;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 earningsInTokens;
        uint256 earningsPercentage;
        bool earlyWithdrawal;
        bool withdrawn;
    }

    /**
     * @dev Stake `amount` tokens for `stakingPlan` period.
     * @param amount Amount of tokens to stake.
     * @param stakingPlan Index of the staking plan to stake for.
     * @return Unique ID of the stake.
     */
    function stake(uint256 amount, uint256 stakingPlan) external returns (uint256);

    /**
     * @dev Withdraw stake from the staking pool.
     * @param stakeId Unique ID of the stake.
     */
    function withdraw(uint256 stakeId) external;

    /**
     * @dev Calculate the earnings in tokens and percentages.
     * @param stakeId Unique ID of the stake.
     * @return earningsInTokens Amount of tokens earned.
     * @return earningsPercentage Percentage of tokens earned.
     */
    function calculateStakeEarnings(
        uint256 stakeId
    ) external view returns (uint256 earningsInTokens, uint16 earningsPercentage);

    /**
     * @dev Calculate the amount of tokens earned for a stake.
     * @param stakeId Unique ID of the stake.
     * @return Amount of tokens earned.
     */
    function getStake(uint256 stakeId) external view returns (Stake memory);

    /**
     * @dev Get all staker stakes data.
     * @param staker Address of the staker.
     * @param offset Offset of the stakes.
     * @param limit Limit of the stakes.
     * @return Array of staker stakes.
     */
    function getStakes(address staker, uint256 offset, uint256 limit) external view returns (Stake[] memory);

    /**
     * @dev Get all stakes data.
     * @param offset Offset of the stakes.
     * @param limit Limit of the stakes.
     * @return Array of stakes.
     */
    function getAllStakes(uint256 offset, uint256 limit) external view returns (Stake[] memory);

    /**
     * @dev Get the amount of staker stakes amount.
     * @param staker Address of the staker.
     * @return Amount of staker stakes staked.
     */
    function getStakesCount(address staker) external view returns (uint256);

    /**
     * @dev Get the amount of stakes.
     * @return Amount of all stakes.
     */
    function getAllStakesCount() external view returns (uint256);

    /**
     * @dev Get all staker stakes ids.
     * @param staker Address of the staker.
     * @return Array of paginated staker stake ids.
     */
    function getStakeIds(address staker) external view returns (uint256[] memory);

    /**
     * @dev Get all stakes ids.
     * @return Array of paginated stake ids.
     */
    function getAllStakeIds() external view returns (uint256[] memory);

    /**
     * @dev Get the total amount of tokens staked by the staker.
     * @param staker Address of the staker.
     * @return Total amount of tokens staked by the staker.
     */
    function getStakedAmount(address staker) external view returns (uint256);

    /**
     * @dev Get the total amount of tokens staked.
     * @return Total amount of tokens staked.
     */
    function getTotalStaked() external view returns (uint256);

    /**
     * @dev Calculate the total earnings in tokens and percentages.
     */
    function calculateTotalEarnings(
        address staker
    ) external view returns (uint256 totalEarningsInTokens, uint16 totalEarningsPercentage);

    /**
     * @dev Returns `true` if a stake exists.
     * @param stakeId Unique ID of the stake.
     */
    function isStakeExists(uint256 stakeId) external view returns (bool);

    /**
     * @dev Returns the address of the staking management contract.
    */
    function getStakingManagement() external view returns (address);

    /**
     * @dev Returns the address of the staking token.
    */
    function getStakingToken() external view returns (address);

    /**
     * @dev Returns the address of the staking pool.
    */
    function getStakingPool() external view returns (address);
}
