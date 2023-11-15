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
    IStakingManagement internal _stakingManagement;

    /**
     * @dev Staking token (IQT).
     */
    IERC20 internal _stakingToken;

    /**
     * @dev Address of the staking pool.
     */
    address internal _stakingPool;

    /**
     * @dev Balance of the staking pool assuming all stakes.
    */
    uint256 internal _stakingPoolSize;

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
    constructor(address stakingManagement, address stakingPool) {
        _stakingManagement = IStakingManagement(stakingManagement);
        _stakingToken = IERC20(_stakingManagement.getStakingToken());
        _stakingPool = stakingPool;
    }

    /**
     * @inheritdoc IStaking
     */
    function stake(uint256 amount, uint256 stakingPlan) external override returns (uint256) {
        _validateStakingAmount(amount, stakingPlan);

        uint256 estimatedEarningsInTokens;
        (estimatedEarningsInTokens, ) = estimateStakeEarnings(amount, stakingPlan);

        _checkStakingPoolBalance(estimatedEarningsInTokens);
        _checkAllowance(amount);

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

        if (stakeRecord.withdrawn) revert StakeAlreadyWithdrawn(stakeId);
        if (currentTimestamp < stakeRecord.endTimestamp) {
            if (!_stakingManagement.isWithdrawEnabled()) {
                revert EarlyWithdrawalNotAllowed(currentTimestamp, stakeRecord.endTimestamp);
            }
            uint256 withdrawalAmount = stakeRecord.amount;
            stakeRecord.earlyWithdrawal = true;
            stakeRecord.withdrawn = true;
            stakeRecord.endTimestamp = currentTimestamp;
            stakeRecord.earningsInTokens = 0;
            stakeRecord.earningsPercentage = 0;
            _stakingToken.transferFrom(_stakingPool, _msgSender(), withdrawalAmount);
        } else {
            (stakeRecord.earningsInTokens, stakeRecord.earningsPercentage) = calculateStakeEarnings(stakeId);
            stakeRecord.withdrawn = true;
            _stakingToken.transferFrom(_stakingPool, _msgSender(), stakeRecord.amount + stakeRecord.earningsInTokens);
        }

        _stakesPerPlan[stakeRecord.stakingPlanId].remove(stakeId);

        emit StakeWithdrawn(_msgSender(), stakeId);
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
    function calculateStakeEarnings(
        uint256 stakeId
    ) public view onlyExistingStake(stakeId) returns (uint256 earningsInTokens, uint16 earningsPercentage) {
        Stake memory stakeRecord = _stakes[stakeId];
        IStakingManagement.StakingPlan memory plan = _stakingManagement.getStakingPlan(stakeRecord.stakingPlanId);

        if (block.timestamp < stakeRecord.startTimestamp) return (0, 0);

        uint256 compoundingFrequency = Constants.DAYS_IN_YEAR;
        uint256 precision = Constants.DECIMALS_PRECISION;
        uint256 dailyRate = (plan.apy * precision) / Constants.MAX_APY / compoundingFrequency;
        uint256 compoundingPeriods = (block.timestamp < stakeRecord.endTimestamp ?
            block.timestamp : stakeRecord.endTimestamp)
            - stakeRecord.startTimestamp;
        uint256 totalCompoundingPeriods = compoundingPeriods / Constants.SECONDS_IN_DAY;
        uint256 compoundedBalance = stakeRecord.amount * precision;

        unchecked {
            for (uint256 i = 0; i < totalCompoundingPeriods; ++i) {
                compoundedBalance += (compoundedBalance * dailyRate / precision);
            }
        }
        earningsInTokens = compoundedBalance / precision - stakeRecord.amount;
        if (block.timestamp > stakeRecord.endTimestamp) {
            earningsInTokens = earningsInTokens * (stakeRecord.endTimestamp - stakeRecord.startTimestamp) / compoundingPeriods;
        }

        if (earningsInTokens > 0 && stakeRecord.amount > 0) {
            earningsPercentage = uint16((earningsInTokens * Constants.MAX_APY * precision) / stakeRecord.amount / precision);
        } else {
            earningsPercentage = 0;
        }

        return (earningsInTokens, earningsPercentage);
    }

    /**
     * @inheritdoc IStaking
     */
    function estimateStakeEarnings(
        uint256 amount,
        uint256 stakingPlanId
    ) public view returns (uint256 predictedEarningsInTokens, uint16 predictedEarningsPercentage) {
        _stakingManagement.checkStakingPlanExists(stakingPlanId);
        IStakingManagement.StakingPlan memory plan = _stakingManagement.getStakingPlan(stakingPlanId);

        uint256 precision = Constants.DECIMALS_PRECISION;

        uint256 dailyRate = (plan.apy * precision) / Constants.MAX_APY / Constants.DAYS_IN_YEAR;
        uint256 compoundingPeriods = plan.duration / Constants.SECONDS_IN_DAY;

        uint256 compoundedBalance = amount * precision;
        for (uint256 i = 0; i < compoundingPeriods; i++) {
            compoundedBalance += (compoundedBalance * dailyRate / precision);
        }

        predictedEarningsInTokens = compoundedBalance / precision - amount;
        predictedEarningsPercentage = (predictedEarningsInTokens > 0 && amount > 0)
            ? uint16((predictedEarningsInTokens * Constants.MAX_APY * precision) / amount / precision)
            : 0;

        return (predictedEarningsInTokens, predictedEarningsPercentage);
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
    function getTotalStaked() external view override returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _allStakeIds.length(); i++) {
            total += _stakes[_allStakeIds.at(i)].amount;
        }
        return total;
    }

    /**
     * @inheritdoc IStaking
     */
    function calculateTotalEarnings(
        address staker
    ) external view returns (uint256 totalEarningsInTokens, uint16 totalEarningsPercentage) {
        uint256[] memory stakeIds = _userStakes[staker].values();
        totalEarningsInTokens = 0;
        uint256 totalWeightedPercentage = 0;

        for (uint256 i = 0; i < stakeIds.length; i++) {
            (uint256 earningsInTokens, uint16 earningsPercentage) = calculateStakeEarnings(stakeIds[i]);
            totalEarningsInTokens += earningsInTokens;

            // Weight the percentage by the earnings in tokens and accumulate
            totalWeightedPercentage += (uint256(earningsPercentage) * earningsInTokens) / 1e4; // Adjust for percentage scale
        }

        if (totalEarningsInTokens > 0) {
            // Calculate the total earnings percentage as a weighted average
            totalEarningsPercentage = uint16((totalWeightedPercentage * 1e4) / totalEarningsInTokens);
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
    function getStakingPoolSize() external view override returns (uint256) {
        return _stakingPoolSize;
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
        uint256 stakingPoolBalance = _stakingToken.balanceOf(_stakingPool);
        if (stakingPoolBalance < _stakingPoolSize + estimatedEarningsInTokens) {
            revert InsufficientStakingPoolBalance(_stakingPoolSize + estimatedEarningsInTokens, stakingPoolBalance);
        }
    }

    /**
     * @dev Checks the allowance to the staking pool.
     * @param amount Amount of tokens to stake.
    */
    function _checkAllowance(uint256 amount) internal view {
        uint256 allowanceToStaking = _stakingToken.allowance(_msgSender(), address(this));
        if (allowanceToStaking < amount) {
            revert InsufficientAllowance(amount, allowanceToStaking);
        }
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
            amount: amount,
            stakingPlanId: stakingPlan,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + stakingPlanDuration,
            earningsInTokens: 0,
            earningsPercentage: 0,
            earlyWithdrawal: false,
            withdrawn: false
        });

        _userStakes[_msgSender()].add(stakeId);
        _allStakeIds.add(stakeId);
        _stakesPerPlan[stakingPlan].add(stakeId);

        return stakeId;
    }

    /**
     * @dev Transfers tokens to the staking pool.
     * @param amount Amount of tokens to stake.
     * @param estimatedEarningsInTokens Estimated earnings in tokens.
    */
    function _transferToStakingPool(uint256 amount, uint256 estimatedEarningsInTokens) internal {
        _stakingToken.transferFrom(_msgSender(), _stakingPool, amount);
        unchecked {
            _stakingPoolSize += amount;
            _stakingPoolSize += estimatedEarningsInTokens;
        }
    }
}
