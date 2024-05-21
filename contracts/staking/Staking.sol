// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import {IStakingManagement} from "../staking-management/IStakingManagement.sol";
import {Constants} from "../library/Constants.sol";
import {IStaking} from "./IStaking.sol";

contract Staking is IStaking, Context {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @dev IStakingManagement instance
     */
    IStakingManagement internal immutable _stakingManagement;

    /**
     * @dev Staking token (IQT).
     */
    IERC20 internal immutable _stakingToken;

    /**
     * @dev Address of the staking pool.
     */
    address internal _stakingPool;

    /**
     * @dev Total amount of tokens staked.
    */
    uint256 internal _totalTokensStaked;

    /**
     * @dev Reward pool size.
    */
    uint256 internal _rewardPoolSize;

    /**
     * @dev Amount of tokens left in the reward pool.
    */
    uint256 internal _rewardPoolLeft;

    /**
     * @dev User stakes data.
     */
    mapping(address => EnumerableSet.UintSet) private _userStakes;

    /**
     * @dev Stakes per plan.
    */
    mapping(uint256 => EnumerableSet.UintSet) private _stakesPerPlan;

    /**
     * @dev Mapping from stakeId => Stake
     */
    mapping(uint256 => Stake) private _stakes;

    /**
     * @dev All stakes IDs.
     */
    EnumerableSet.UintSet private _allStakeIds;

    /**
     * @dev Reverts if the stake does not exist.
     * @param stakeId Unique stake ID.
     */
    modifier onlyExistingStake(uint256 stakeId) {
        if (!_isStakeExists(stakeId)) revert StakeDoesNotExist(stakeId);
        _;
    }

    /**
     * @dev Reverts if the caller is not the stake owner.
     * @param stakeId Unique stake ID
     */
    modifier onlyStakeOwner(uint256 stakeId) {
        if (_msgSender() != _stakes[stakeId].staker) revert CallerIsNotStakeOwner(stakeId);
        _;
    }

    /**
     * @dev Constructor.
     * @param stakingManagement Address of the staking management contract.
     */
    constructor(address stakingManagement, address stakingPool, uint256 rewardPoolSize) {
        _stakingManagement = IStakingManagement(stakingManagement);
        _stakingToken = IERC20(_stakingManagement.getStakingToken());
        _stakingPool = stakingPool;
        _rewardPoolSize = rewardPoolSize;
        _rewardPoolLeft = _rewardPoolSize;
    }

    /**
     * @inheritdoc IStaking
     */
    function stake(uint256 amount, uint256 stakingPlan) external override returns (uint256) {
        _validateStakingAmount(amount, stakingPlan);

        uint256 estimatedEarningsInTokens;
        (estimatedEarningsInTokens, ) = estimateStakeEarnings(amount, stakingPlan);

        _checkStakingPoolBalance(estimatedEarningsInTokens);

        uint256 stakeId = _createStakeRecord(amount, stakingPlan);

        _transferToStakingPool(amount, estimatedEarningsInTokens);

        emit StakeAdded(_msgSender(), stakeId);

        return stakeId;
    }

    /**
     * @inheritdoc IStaking
     */
    function withdraw(uint256 stakeId) external override onlyExistingStake(stakeId) onlyStakeOwner(stakeId)  {
        Stake storage stakeRecord = _stakes[stakeId];
        uint256 currentTimestamp = block.timestamp;
        bool isEarlyWithdrawalAllowed = _stakingManagement.isWithdrawEnabled();

        uint256 stakedAmount = stakeRecord.amount;
        (uint256 estimatedEarningsInTokens, ) = estimateStakeEarnings(stakedAmount, stakeRecord.stakingPlanId);
        uint256 withdrawalAmount;
        bool earlyWithdrawal;

        if (stakeRecord.withdrawn) revert StakeAlreadyWithdrawn(stakeId);
        if (currentTimestamp < stakeRecord.endTimestamp) {
            if (!isEarlyWithdrawalAllowed) {
                revert EarlyWithdrawalNotAllowed(currentTimestamp, stakeRecord.endTimestamp);
            } else {
                earlyWithdrawal = true;
            }

            withdrawalAmount = stakedAmount;
            stakeRecord.earlyWithdrawal = earlyWithdrawal;
            stakeRecord.withdrawn = true;
            stakeRecord.endTimestamp = currentTimestamp;
            stakeRecord.earningsInTokens = 0;
            stakeRecord.earningsPercentage = 0;
        } else {
            (stakeRecord.earningsInTokens, stakeRecord.earningsPercentage) = calculateStakeEarnings(stakeId);
            stakeRecord.withdrawn = true;
            withdrawalAmount = stakeRecord.amount + stakeRecord.earningsInTokens;
        }

        // check that withdrawable amount successfully transferred to staker
        if (!_stakingToken.transferFrom(_stakingPool, _msgSender(), withdrawalAmount)) {
            revert ErrorDuringWithdrawTransfer(_stakingPool, _msgSender(),  withdrawalAmount);
        }

        // subtract withdrawal amount from total staked
        _totalTokensStaked -= stakedAmount;

        // add earnings to reward pool if early withdrawal
        if (earlyWithdrawal && isEarlyWithdrawalAllowed) {
            _rewardPoolLeft += estimatedEarningsInTokens;
        }

        // remove stake from stakes per plan counter
        if (!_stakesPerPlan[stakeRecord.stakingPlanId].remove(stakeId)) {
            revert ErrorDuringRemovingStakeFromPlan(stakeId, stakeRecord.stakingPlanId);
        }

        emit StakeWithdrawn(_msgSender(), stakeId);
    }

    /**
     * @inheritdoc IStaking
     */
    function setRewardPoolSize(uint256 rewardPoolSize) external override {
        uint256 totalRewardsGiven = _rewardPoolSize - _rewardPoolLeft;

        if (rewardPoolSize < totalRewardsGiven) {
            revert NewRewardPoolSizeIsLessThanGiven(rewardPoolSize, totalRewardsGiven);
        }

        _rewardPoolSize = rewardPoolSize;
        _rewardPoolLeft = rewardPoolSize - totalRewardsGiven;
    }

    /**
     * @inheritdoc IStaking
     */
    function getStake(uint256 stakeId) external view override onlyExistingStake(stakeId) returns (Stake memory) {
        return _stakes[stakeId];
    }

    /**
     * @inheritdoc IStaking
     */
    function estimateStakeEarnings(
        uint256 amount,
        uint256 stakingPlanId
    ) public view returns (uint256 predictedEarningsInTokens, uint256 predictedEarningsPercentage) {
        if (amount == 0) return (0, 0);

        _stakingManagement.checkStakingPlanExists(stakingPlanId);
        IStakingManagement.StakingPlan memory plan = _stakingManagement.getStakingPlan(stakingPlanId);

        return _calculateEarnings(amount, stakingPlanId, plan.duration);
    }

    /**
     * @inheritdoc IStaking
     */
    function calculateStakeEarnings(
        uint256 stakeId
    ) public view onlyExistingStake(stakeId) returns (uint256 earningsInTokens, uint256 earningsPercentage) {
        Stake memory stakeRecord = _stakes[stakeId];

        uint256 elapsedDuration = block.timestamp - stakeRecord.startTimestamp;

        return _calculateEarnings(stakeRecord.amount, stakeRecord.stakingPlanId, elapsedDuration);
    }

    /**
     * @inheritdoc IStaking
     */
    function simulateStakeEarnings(
        uint256 stakeId,
        uint256 timestamp
    ) public view onlyExistingStake(stakeId) returns (uint256 earningsInTokens, uint256 earningsPercentage) {
        Stake memory stakeRecord = _stakes[stakeId];

        if (timestamp < stakeRecord.startTimestamp) {
            revert InvalidSimulationTimestamp(timestamp, stakeRecord.startTimestamp);
        }

        uint256 elapsedDuration = timestamp - stakeRecord.startTimestamp;

        return _calculateEarnings(stakeRecord.amount, stakeRecord.stakingPlanId, elapsedDuration);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakes(address staker, uint256 offset, uint256 limit) external view override returns (Stake[] memory) {
        uint256 stakeCount = _userStakes[staker].length();
        if (offset >= stakeCount) {
            return new Stake[](0);
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        unchecked {
            for (uint256 i = 0; i < limit; ++i) {
                uint256 stakeId = _userStakes[staker].at(offset + i);
                stakes[i] = _stakes[stakeId];
            }
        }

        return stakes;
    }

    /**
     * @inheritdoc IStaking
     */
    function getAllStakes(uint256 offset, uint256 limit) external view override returns (Stake[] memory) {
        uint256 stakeCount = _allStakeIds.length();
        if (offset >= stakeCount) {
            return new Stake[](0);
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 stakeId = _allStakeIds.at(offset + i);
            stakes[i] = _stakes[stakeId];
        }

        return stakes;
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakesAndIds(address staker, uint256 offset, uint256 limit) external view override returns (Stake[] memory, uint256[] memory) {
        uint256 stakeCount = _userStakes[staker].length();
        if (offset >= stakeCount) {
            return (new Stake[](0), new uint256[](0));
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        uint256[] memory stakeIds = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 stakeId = _userStakes[staker].at(offset + i);
            stakes[i] = _stakes[stakeId];
            stakeIds[i] = stakeId;
        }

        return (stakes, stakeIds);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakesWithIdsAndEarnings(
        address staker,
        uint256 offset,
        uint256 limit
    ) external view returns(Stake[] memory, uint256[] memory, StakeEarnings[] memory) {
        uint256 stakeCount = _userStakes[staker].length();
        if (offset >= stakeCount) {
            return (new Stake[](0), new uint256[](0), new StakeEarnings[](0));
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        uint256[] memory stakeIds = new uint256[](limit);
        StakeEarnings[] memory earnings = new StakeEarnings[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 stakeId = _userStakes[staker].at(offset + i);
            stakes[i] = _stakes[stakeId];
            stakeIds[i] = stakeId;
            (earnings[i].earningsInTokens, earnings[i].earningsPercentage) = calculateStakeEarnings(stakeId);
            (earnings[i].estimatedEarningsInTokens, earnings[i].estimatedEarningsPercentage) = estimateStakeEarnings(stakes[i].amount, stakes[i].stakingPlanId);
        }

        return (stakes, stakeIds, earnings);
    }

    /**
     * @inheritdoc IStaking
    */
    function getStakesCount(address staker) external view override returns (uint256) {
        return _userStakes[staker].length();
    }

    /**
     * @inheritdoc IStaking
     */
    function getAllStakesCount() external view override returns (uint256) {
        return _allStakeIds.length();
    }

    /**
     * @inheritdoc IStaking
     */
    function getUserStakeIds(address staker, uint256 offset, uint256 limit) external view override returns (uint256[] memory) {
        uint256 stakeCount = _userStakes[staker].length();
        if (offset >= stakeCount) {
            return new uint256[](0);
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        uint256[] memory stakeIds = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            stakeIds[i] = _userStakes[staker].at(offset + i);
        }

        return stakeIds;
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakeIds(address staker) external view override returns (uint256[] memory) {
        return _userStakes[staker].values();
    }

    /**
     * @inheritdoc IStaking
     */
    function getAllStakeIds() external view override returns (uint256[] memory) {
        return _allStakeIds.values();
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakedAmount(address staker) external view override returns (uint256) {
        uint256 total = 0;
        uint256[] memory stakeIds = _userStakes[staker].values();
        for (uint256 i = 0; i < stakeIds.length; i++) {
            total += _stakes[stakeIds[i]].amount;
        }
        return total;
    }

    /**
     * @inheritdoc IStaking
     */
    function calculateTotalEarnings(
        address staker
    ) external view returns (uint256 totalEarningsInTokens, uint256 totalEarningsPercentage) {
        uint256[] memory stakeIds = _userStakes[staker].values();
        totalEarningsInTokens = 0;
        uint256 totalWeightedPercentage = 0;
        uint256 totalPrincipal = 0;

        for (uint256 i = 0; i < stakeIds.length; i++) {
            uint256 stakeId = stakeIds[i];
            Stake memory stakeRecord = _stakes[stakeId];
            uint256 principal = stakeRecord.amount;

            (uint256 earningsInTokens, uint256 earningsPercentage) = calculateStakeEarnings(stakeId);
            totalEarningsInTokens += earningsInTokens;
            totalPrincipal += principal;

            // Weight the percentage by the principal amount and accumulate
            totalWeightedPercentage += (earningsPercentage * principal);
        }

        if (totalPrincipal > 0) {
            // Calculate the average weighted earnings percentage
            totalEarningsPercentage = totalWeightedPercentage / totalPrincipal;
        } else {
            totalEarningsPercentage = 0;
        }

        return (totalEarningsInTokens, totalEarningsPercentage);
    }

    /**
     * @inheritdoc IStaking
     */
    function isStakeExists(uint256 stakeId) external view override returns (bool) {
        return _isStakeExists(stakeId);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakingManagement() external view override returns (address) {
        return address(_stakingManagement);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakingToken() external view override returns (address) {
        return address(_stakingToken);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakesAmountPerPlan(uint256 stakingPlanId) external view override returns (uint256) {
        _stakingManagement.checkStakingPlanExists(stakingPlanId);
        return _stakesPerPlan[stakingPlanId].length();
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakesPerPlan(uint256 stakingPlanId, uint256 offset, uint256 limit) external view override returns (Stake[] memory) {
        _stakingManagement.checkStakingPlanExists(stakingPlanId);
        uint256 stakeCount = _stakesPerPlan[stakingPlanId].length();
        if (offset >= stakeCount) {
            return new Stake[](0);
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 stakeId = _stakesPerPlan[stakingPlanId].at(offset + i);
            stakes[i] = _stakes[stakeId];
        }

        return stakes;
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakingPool() external view override returns (address) {
        return _stakingPool;
    }

    /**
     * @inheritdoc IStaking
     */
    function getTotalTokensStaked() external view override returns (uint256) {
        return _totalTokensStaked;
    }

    /**
     * @inheritdoc IStaking
     */
    function getRewardPoolSize() external view override returns (uint256) {
        return _rewardPoolSize;
    }

    /**
     * @inheritdoc IStaking
     */
    function getRewardPoolLeft() external view override returns (uint256) {
        return _rewardPoolLeft;
    }

    /**
     * @dev Returns `true` if a stake exists.
     * @param stakeId Unique ID of the stake.
     */
    function _isStakeExists(uint256 stakeId) internal view returns (bool) {
        return _allStakeIds.contains(stakeId);
    }

    /**
     * @dev Validates the staking amount.
     * @param amount Amount of tokens to stake.
    */
    function _validateStakingAmount(uint256 amount, uint256 stakingPlan) internal view {
        _stakingManagement.checkStakingPlanExists(stakingPlan);
        if (amount < _stakingManagement.getMinimumStake()) revert AmountIsLessThanMinimumStake(amount);
        if (amount > _stakingManagement.getMaximumStake()) revert AmountIsGreaterThanMaximumStake(amount);
    }

    /**
     * @dev Checks the staking pool balance.
     * @param estimatedEarningsInTokens Estimated earnings in tokens.
    */
    function _checkStakingPoolBalance(uint256 estimatedEarningsInTokens) internal view {
        if (_rewardPoolLeft < estimatedEarningsInTokens) {
            revert InsufficientRewardPoolBalance(estimatedEarningsInTokens, _rewardPoolLeft);
        }
    }

    /**
     * @dev Calculates the earnings for a stake.
     * @param amount Amount of tokens staked.
     * @param stakingPlanId Index of the staking plan.
     * @param duration Duration of the stake.
    */
    function _calculateEarnings(
        uint256 amount,
        uint256 stakingPlanId,
        uint256 duration
    ) internal view returns (uint256 earningsInTokens, uint256 earningsPercentage) {
        IStakingManagement.StakingPlan memory plan = _stakingManagement.getStakingPlan(stakingPlanId);

        if (duration >= plan.duration) {
            duration = plan.duration;
        }

        uint256 precision = 1e18;
        uint256 compoundingPeriods;
        uint256 periodRate;

        // compoundingPeriods = duration / Constants.SECONDS_IN_DAY;
        // periodRate = (plan.apy * precision) / (Constants.HUNDRED_PERCENT * Constants.DAYS_IN_YEAR);

        // if (plan.duration >= Constants.SECONDS_IN_YEAR) {
        //     compoundingPeriods = duration / Constants.SECONDS_IN_YEAR;
        //     periodRate = (plan.apy * precision) / Constants.HUNDRED_PERCENT;
        // }

        if (duration >= Constants.SECONDS_IN_YEAR) {
            // Annual compounding
            compoundingPeriods = duration / Constants.SECONDS_IN_YEAR;
            periodRate = (plan.apy * precision) / Constants.HUNDRED_PERCENT;
        } else {
            // Monthly compounding
            compoundingPeriods = duration / Constants.SECONDS_IN_MONTH;
            periodRate = (plan.apy * precision) / (Constants.HUNDRED_PERCENT * Constants.MONTHS_IN_YEAR);
        }

        uint256 compoundedBalance = amount * precision;

        for (uint256 i = 0; i < compoundingPeriods; i++) {
            compoundedBalance = compoundedBalance * (precision + periodRate) / precision;
        }

        earningsInTokens = (compoundedBalance / precision) - amount;
        earningsPercentage = (earningsInTokens * Constants.HUNDRED_PERCENT) / amount;

        return (earningsInTokens, earningsPercentage);
    }

    /**
     * @dev Creates a new stake record.
     * @param amount Amount of tokens to stake.
     * @param stakingPlan Index of the staking plan to stake for.
    */
    function _createStakeRecord(uint256 amount, uint256 stakingPlan) internal returns (uint256 stakeId) {
        stakeId = _allStakeIds.length() + 1;
        uint256 stakingPlanDuration = _stakingManagement.getStakingPlan(stakingPlan).duration;
        _stakes[stakeId] = Stake({
            staker: _msgSender(),
            withdrawn: false,
            amount: amount,
            stakingPlanId: stakingPlan,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + stakingPlanDuration,
            earningsInTokens: 0,
            earningsPercentage: 0,
            earlyWithdrawal: false
        });

        // check that stake successfully added to user stakes
        if(!_userStakes[_msgSender()].add(stakeId)) {
            revert ErrorDuringAddingUserStake(stakeId);
        }
        // check that stake successfully added to all stakes
        if(!_allStakeIds.add(stakeId)) {
            revert ErrorDuringAddingStake(stakeId);
        }
        // check that stake successfully added to stakes per plan
        if(!_stakesPerPlan[stakingPlan].add(stakeId)) {
            revert ErrorDuringAddingStakeToPlan(stakeId, stakingPlan);
        }

        return stakeId;
    }

    /**
     * @dev Transfers tokens to the staking pool.
     * @param amount Amount of tokens to stake.
     * @param estimatedEarningsInTokens Estimated earnings in tokens.
    */
    function _transferToStakingPool(uint256 amount, uint256 estimatedEarningsInTokens) internal {
        // check that stake amount successfully transferred to staking pool
        if (!_stakingToken.transferFrom(_msgSender(), _stakingPool, amount)) {
            revert ErrorDuringStakeTransfer(_msgSender(), _stakingPool, amount);
        }

        unchecked {
            _totalTokensStaked += amount;
            _rewardPoolLeft -= estimatedEarningsInTokens;
        }
    }
}
